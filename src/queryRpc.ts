import { ethers } from 'ethers';
import { from, Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import FeeCollectorABIJson from './contracts/FeeCollectorABI.json';

import dotenv from 'dotenv';
dotenv.config();

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
const contract = new ethers.Contract(CONTRACT_ADDRESS, FeeCollectorABI, wsProvider);

// Function to create an Observable that listens for new events
function feesCollectedObservable() {
  return new Observable(subscriber => {
    contract.on("FeesCollected", (_token, _integrator, _integratorFee, _lifiFee, event) => {
      // Create an object with the event details
      // The toString() method is called on _integratorFee and _lifiFee because these are likely BigNumber objects
      const eventData = {
        token: _token,
        integrator: _integrator,
        integratorFee: _integratorFee.toString(),
        lifiFee: _lifiFee.toString(),
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash
      };

      // Emit the event data
      subscriber.next(eventData);
    });

    // Cleanup logic in case of unsubscription
    return () => {
      contract.removeAllListeners("FeesCollected");
    };
  });
}


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

// Subscribe to the observable to listen for new events
const feesCollectedSubscription = feesCollectedObservable().subscribe({
  next: event => {
    console.log(`FeesCollected Event:`, event);
  },
  error: err => console.error('Error:', err),
  complete: () => console.log('Completed')
});

// To unsubscribe (e.g., when shutting down the application)
// feesCollectedSubscription.unsubscribe();
