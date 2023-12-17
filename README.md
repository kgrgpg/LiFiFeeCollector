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

```sh
npm start
```
This command will start the application, which listens for FeeCollected events from the FeeCollector contract and provides a REST API interface.

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
