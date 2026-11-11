import { PointerActivationConstraints, PointerSensor } from "@dnd-kit/dom";

export const CardPointerSensor = PointerSensor.configure({
  activatorElements: (source) => [source.element],
  activationConstraints: (event) => event.pointerType === "touch"
    ? [new PointerActivationConstraints.Delay({ value: 200, tolerance: 8 })]
    : [new PointerActivationConstraints.Distance({ value: 6 })],
});
