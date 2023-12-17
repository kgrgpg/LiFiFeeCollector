# LiFi Fee Collector

This project is designed for handling Ethereum smart contract interactions with the `FeeCollector` contract, processing and storing blockchain events, and providing a REST API interface. Below are the steps to set up, build, and run the project.

## Prerequisites

- Node.js 
- npm 
- TypeScript 
- Ethereum wallet with RPC access 
- MongoDB 

## Setup

1. Install dependencies
   ```sh
   npm install
   ```
2. Set Environment Variables:
   * Copy the .env.example file to a new file named .env.
   * Fill in the environment variables in .env with your specific settings (e.g., Ethereum RPC URL, MongoDB connection string).
3. Building the project
   ```sh
   npm run build
   ```
   This will compile the TypeScript files and generate the corresponding JavaScript files in a dist directory.
   
## Running the Project

**Start the MongoDB Database:**

1. Ensure MongoDB is running on your machine.
2. Make sure the connection details match those specified in your `.env` file.

**Run the Application:**

You can start the applications individually or both at the same time. Ensure your MongoDB database and Ethereum RPC are configured and running as expected.

1. **Start the `queryRpc` Application:**
   This application listens for `FeeCollected` events from the `FeeCollector` contract.
   ```sh
   npm run start:queryRpc
   ```
2. **Start the `restServer` Application:**
   This application provides a REST API interface.
   ```sh
   npm run start:restServer
   ```
3. **Run both together:**
   To start both queryRpc and restServer simultaneously:
   ```sh
   npm run start
   ```



## REST API Usage

**Get FeeCollected Events:**

- **Endpoint:** `GET /events/:integrator`
- **Description:** Retrieves all collected events for a given integrator.
- **Example:** `curl http://localhost:3000/events/0xIntegratorAddress`

## Additional Information

**Contract Interactions:**

- The `FeeCollectorABI.json` file in the `contracts` directory is used for interacting with the FeeCollector smart contract.

**Event Processing:**

- The `FeeCollectedEvent.ts` model in the `models` directory represents the structure of the collected events.

**Querying the RPC:**

- The `queryRpc.ts` file handles querying the Ethereum RPC.
