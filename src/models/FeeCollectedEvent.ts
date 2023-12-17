import { prop, getModelForClass } from '@typegoose/typegoose';
export class FeeCollectedEvent {
  @prop({ required: true })
  public token!: string;

  @prop({ required: true })
  public integrator!: string;

  @prop({ required: true })
  public integratorFee!: bigint;

  @prop({ required: true })
  public lifiFee!: bigint;

  @prop({ required: true, unique: true })
  public transactionHash!: string;

  @prop({ required: true })
  public blockNumber!: number;
}

export const FeeCollectedEventModel = getModelForClass(FeeCollectedEvent);
