import { ethers } from 'ethers';
import { from } from 'rxjs';
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
getLatestBlockNumber().subscribe({
  next: blockNumber => console.log(`Latest Polygon Mainnet Block Number: ${blockNumber}`),
  error: err => console.error('Error in subscription:', err)
});
