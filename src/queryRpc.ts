import { ethers, EventFilter, EventLog, Log } from 'ethers';
import { from, Observable, of, timer } from 'rxjs';
import { catchError, switchMap, mergeWith, mergeMap, retry, map } from 'rxjs/operators';
import { FeeCollectedEvent, FeeCollectedEventModel } from './models/FeeCollectedEvent';
import FeeCollectorABIJson from './contracts/FeeCollectorABI.json';
import playSound from 'play-sound';

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/LiFiFeeCollectorDb';
mongoose.connect(mongoUri)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("Could not connect to MongoDB:", err));

// Replace with your Infura project ID
const INFURA_PROJECT_ID = process.env.INFURA_PROJECT_ID;

// Infura URL for the Polygon mainnet
const polygonHttpUrl = `https://polygon-mainnet.infura.io/v3/${INFURA_PROJECT_ID}`;
const polygonWsUrl = `wss://polygon-mainnet.infura.io/ws/v3/${INFURA_PROJECT_ID}`;

// Setup provider using Infura
const httpProvider = new ethers.JsonRpcProvider(polygonHttpUrl);
const wsProvider = new ethers.WebSocketProvider(polygonWsUrl);

// Use FeeCollectorABI in your ethers contract setup
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
if (!CONTRACT_ADDRESS) {
  throw new Error("CONTRACT_ADDRESS environment variable is not set");
}
// Parse the ABI string to an object
const FeeCollectorABI = JSON.parse(FeeCollectorABIJson.result);
const feesCollectorContract = new ethers.Contract(CONTRACT_ADDRESS, FeeCollectorABI, wsProvider);

// Start block number to start listening for events
const START_BLOCK = Number(process.env.START_BLOCK);

// Function to create an Observable that listens for new blocks
function newBlockObservable() {
  return new Observable<number>(observer => {
    wsProvider.on("block", (blockNumber) => {
      observer.next(blockNumber);
    });

    // Cleanup logic in case of unsubscription
    return () => {
      wsProvider.removeAllListeners("block");
    };
  });
}

// Function to listen to real-time FeeCollected events
function listenToRealTimeEvents(): Observable<FeeCollectedEvent[]> {
  return new Observable<FeeCollectedEvent[]>(subscriber => {
    const setupEventListener = () => {
      feesCollectorContract.on("FeesCollected", (_token, _integrator, _integratorFee, _lifiFee, event) => {
        console.log("Real-time event received:", {
          token: _token,
          integrator: _integrator,
          integratorFee: _integratorFee,
          lifiFee: _lifiFee,
          eventDetails: event
        });
        const parsedEvent = parseRealTimeFeesCollectedEvents([event]);
        subscriber.next(parsedEvent);
      });
    };

    setupEventListener();
    // Log when setup is called
    console.log("Setting up real-time event listener");

    return () => {
      console.log("Removing real-time event listener");
      feesCollectorContract.removeAllListeners("FeesCollected");
    };
  }).pipe(
    retry({
      count: 3, // Retry up to 3 times
      delay: (error, retryCount) => {
        console.log(`Attempt ${retryCount}: retrying in ${retryCount * 1000}ms`);
        return timer(retryCount * 1000); // Use timer to create a delay
      }
    })
  );
}

// Function to parse real-time FeeCollected events
function parseRealTimeFeesCollectedEvents(eventDetails: any[]): FeeCollectedEvent[] {
  return eventDetails.map(eventDetail => {
    const eventLog = eventDetail.log;
    const feesCollected: FeeCollectedEvent = {
      token: eventLog.args[0],
      integrator: eventLog.args[1],
      integratorFee: BigInt(eventLog.args[2]),
      lifiFee: BigInt(eventLog.args[3]),
      transactionHash: eventLog.transactionHash,
      blockNumber: eventLog.blockNumber
    };
    return feesCollected;
  });
}



// Function to parse events
function parseHistoricalFeesCollectedEvents(events: EventLog[]): FeeCollectedEvent[] {
  return events.map(event => {
    const feesCollected: FeeCollectedEvent = {
      token: event.args[0],
      integrator: event.args[1],
      integratorFee: BigInt(event.args[2]),
      lifiFee: BigInt(event.args[3]),
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber
    };
    return feesCollected;
  });
}

// Function to get historical events
function getHistoricalFeesCollectedEventsObservable(fromBlock: number, toBlock: number) {
  const eventFilter = feesCollectorContract.filters.FeesCollected();
  return from(feesCollectorContract.queryFilter(eventFilter, fromBlock, toBlock)).pipe(
    switchMap(events => {
      // Filter out only EventLog objects
      const eventLogs = events.filter((event): event is EventLog => event instanceof EventLog);
      const parsedEvents = parseHistoricalFeesCollectedEvents(eventLogs);
      return of(parsedEvents);
    }),
    catchError(error => {
      console.error('Error fetching historical events:', error);
      throw error;
    })
  );
}

// Function to get the latest stored block number
function getLatestStoredBlockNumber(): Observable<number> {
  return from(
    FeeCollectedEventModel.findOne().sort({ blockNumber: -1 }).limit(1).exec()
  ).pipe(
    map(event => event ? event.blockNumber : START_BLOCK),
    catchError(error => {
      console.error('Error fetching latest stored block number:', error);
      return of(START_BLOCK); // Default to START_BLOCK in case of error
    })
  );
}

// Creating observables for historical and real-time events
const latestBlockNumber$ = from(wsProvider.getBlockNumber());
const realTimeEvents$ = listenToRealTimeEvents();
// For historical events, we need to get the historical events from the last stored block to the latest block
const historicalEvents$ = getLatestStoredBlockNumber().pipe(
  switchMap(latestStoredBlock => {
    const fromBlock = latestStoredBlock + 1; // Start from the next block after the latest stored
    return latestBlockNumber$.pipe(
      switchMap(toBlock => {
        if (fromBlock > toBlock) {
          return of([]); // No new blocks to process
        }
        return getHistoricalFeesCollectedEventsObservable(fromBlock, toBlock);
      })
    );
  }),
  mergeMap(events => events), // Flatten the array of events
  catchError(error => {
    console.error('Error fetching historical events:', error);
    return of([]);
  })
);

// Create an instance of the play-sound module
const play = playSound();

function playBeep() {
  play.play('./censorBeep.wav', (err: Error | null) => {
    if (err) {
      console.error('Error playing sound:', err);
    } else {
      console.log('Sound played successfully');
    }
  });
}

// Merging the observables using mergeWith
const allEvents$ = historicalEvents$.pipe(
  mergeWith(realTimeEvents$)
);

// Subscribing to the merged observable
allEvents$.pipe(
  mergeMap(events => 
    Array.isArray(events) ? from(events) : of(events)
  ), // Ensure events is an observable stream
  mergeMap(event => 
    from(FeeCollectedEventModel.findOne({ transactionHash: event.transactionHash }).exec()).pipe(
      mergeMap(existingEvent => {
        if (existingEvent) {
          console.log('Event already exists in MongoDB:', existingEvent);
          return of(null); // Event already exists, return null
        } else {
          const newEvent = new FeeCollectedEventModel(event);
          return from(newEvent.save()).pipe(
            mergeMap(() => of(event)) // Return the event data
          );
        }
      }),
      catchError(error => {
        console.error('Error processing event:', error);
        return of(null); // Handle the error
      })
    )
  ),
  catchError(err => {
    console.error('Error in the event stream:', err);
    return of(null); // Handle or rethrow the error
  })
).subscribe({
  next: event => {
    if (event) {
      console.log('Event saved to MongoDB:', event);
      // playBeep();
    }
  },
  error: err => console.error('Error:', err),
  complete: () => console.log('Completed event stream')
});
