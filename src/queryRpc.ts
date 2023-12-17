import { ethers, EventFilter, EventLog, Log } from 'ethers';
import { from, Observable, of } from 'rxjs';
import { catchError, switchMap, mergeWith, mergeMap } from 'rxjs/operators';
import { FeeCollectedEvent, FeeCollectedEventModel } from './models/FeeCollectedEvent';
import FeeCollectorABIJson from './contracts/FeeCollectorABI.json';

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

mongoose.connect('mongodb://localhost:27017/LiFiFeeCollectorDb')
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

// Subscribe to the observable to listen for new blocks
const blockSubscription = newBlockObservable().subscribe({
  next: blockNumber => console.log(`New Polygon Mainnet Block Number: ${blockNumber}`),
  error: err => console.error('Error in block subscription:', err),
  complete: () => console.log('Block subscription completed')
});

// If you ever need to stop listening for blocks, you can unsubscribe
// blockSubscription.unsubscribe();

// Function to listen to real-time FeeCollected events
function listenToRealTimeEvents(): Observable<FeeCollectedEvent[]> {
  return new Observable(subscriber => {
    feesCollectorContract.on("FeesCollected", (event) => {
      const parsedEvents = parseFeesCollectedEvents([event]);
      subscriber.next(parsedEvents);
    });

    // Cleanup function
    return () => {
      feesCollectorContract.removeAllListeners("FeesCollected");
    };
  });
}

// Function to parse events
function parseFeesCollectedEvents(events: EventLog[]): FeeCollectedEvent[] {
  return events.map(event => {
    const feesCollected: FeeCollectedEvent = {
      token: event.args[0],
      integrator: event.args[1],
      integratorFee: BigInt(event.args[2]),
      lifiFee: BigInt(event.args[3]),
      transactionHash: event.transactionHash
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
      const parsedEvents = parseFeesCollectedEvents(eventLogs);
      return of(parsedEvents);
    }),
    catchError(error => {
      console.error('Error fetching historical events:', error);
      throw error;
    })
  );
}

// Creating observables for historical and real-time events
const latestBlockNumber$ = from(wsProvider.getBlockNumber());
const realTimeEvents$ = listenToRealTimeEvents();
const historicalEvents$ = latestBlockNumber$.pipe(
  switchMap(toBlock => getHistoricalFeesCollectedEventsObservable(START_BLOCK, toBlock)), // START_BLOCK needs to be defined
  catchError(error => {
    console.error('Error fetching historical events:', error);
    return []; // Fallback in case of error
  })
);

// Merging the observables using mergeWith
const allEvents$ = historicalEvents$.pipe(
  mergeWith(realTimeEvents$)
);

// Subscribing to the merged observable
allEvents$.pipe(
  mergeMap(events => events),
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
    }
  },
  error: err => console.error('Error:', err),
  complete: () => console.log('Completed event stream')
});
