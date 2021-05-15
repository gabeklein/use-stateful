import { useEffect, useMemo } from 'react';

import { values } from './util';

export const Lifecycle = {
  WILL_RESET: "willReset",
  WILL_RENDER: "willRender",
  WILL_UPDATE: "willUpdate",
  WILL_MOUNT: "willMount",
  WILL_UNMOUNT: "willUnmount",
  DID_RENDER: "didRender",
  DID_MOUNT: "didMount"
};

export type LifecycleEvent = Values<typeof Lifecycle>;

export function forAlias(prefix: string){
  const map = new Map<LifecycleEvent, string>();

  for(const name of values(Lifecycle))
    map.set(name, prefix + name[0].toUpperCase() + name.slice(1));

  return (name: LifecycleEvent) => map.get(name)!;
}

export function useLifecycleEffect(
  onEvent: (name: LifecycleEvent) => void){

  let isFirstRender: true | undefined;

  const event = useMemo(() => {
    isFirstRender = true;
    return onEvent;
  }, []);

  event(isFirstRender ? Lifecycle.WILL_MOUNT : Lifecycle.WILL_UPDATE);
  event(Lifecycle.WILL_RENDER);

  useEffect(() => {
    event(Lifecycle.DID_RENDER);
    return () => event(Lifecycle.WILL_RESET);
  })

  useEffect(() => {
    event(Lifecycle.DID_MOUNT);
    return () => event(Lifecycle.WILL_UNMOUNT);
  }, [])
}