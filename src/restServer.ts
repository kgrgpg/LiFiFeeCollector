import express from 'express';
import { from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { FeeCollectedEventModel } from './models/FeeCollectedEvent';

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/LiFiFeeCollectorDb';
mongoose.connect(mongoUri)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("Could not connect to MongoDB:", err));

const app = express();
const port = 3000;

function bigIntReplacer(key: string, value: any) {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}
// Endpoint to get events for a specific integrator
app.get('/events/:integrator', (req, res) => {
  const integratorAddress = req.params.integrator.toLowerCase();
  console.log(`Getting events for integrator ${integratorAddress}`);

  // Create an Observable from the MongoDB query
  const events$ = from(FeeCollectedEventModel.find({ integrator: integratorAddress }).exec());

  events$.pipe(
    map(events => {
      console.log(`Query result for integrator ${integratorAddress}:`, events);
      return JSON.stringify(events, bigIntReplacer);
    }),
    map(jsonString => res.type('json').send(jsonString)),
    catchError(error => {
        console.error(error);
        // Return an observable with the response
        return of(res.status(500).send('An error occurred'));
    })
  ).subscribe();
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
