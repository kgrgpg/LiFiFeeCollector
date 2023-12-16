export interface ParsedFeeCollectedEvent {
  token: string;
  integrator: string;
  integratorFee: BigInt;
  lifiFee: BigInt;
}
