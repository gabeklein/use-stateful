import { Controller } from "./controller";

export type BunchOf<T> = { [key: string]: T }

export type State = LiveState & BunchOf<any>

export type ExpectsParams<A extends any[]> = new (...args: A) => any;

export type UpdateTrigger = (beat: number) => void;

export interface LiveState<State = any> {
  refresh(): void;
  add(key: string, initial?: any): void;
  export(): State;
}

export interface Lifecycle {
  willUnmount?: VoidFunction
  didMount?: VoidFunction
}