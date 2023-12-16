import { ethers } from 'ethers';
import { from, Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';

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

// Function to get the latest block number using RxJS
function getLatestBlockNumber() {
  return from(wsProvider.getBlockNumber()).pipe(
    catchError(error => {
      console.error('Error querying the Polygon Mainnet:', error);
      throw error;
    })
  );
}

// Subscribe to the observable to perform the query
// getLatestBlockNumber().subscribe({
//   next: blockNumber => console.log(`Latest Polygon Mainnet Block Number: ${blockNumber}`),
//   error: err => console.error('Error in subscription:', err)
// });

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
