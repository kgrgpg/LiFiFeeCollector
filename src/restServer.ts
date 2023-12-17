import express from 'express';
import { from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { FeeCollectedEventModel } from './models/FeeCollectedEvent';

import mongoose from 'mongoose';

mongoose.connect('mongodb://localhost:27017/LiFiFeeCollectorDb')
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
  const integratorAddress = req.params.integrator;

  // Create an Observable from the MongoDB query
  const events$ = from(FeeCollectedEventModel.find({ integrator: integratorAddress }).exec());

  events$.pipe(
    map(events => JSON.stringify(events, bigIntReplacer)),
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
