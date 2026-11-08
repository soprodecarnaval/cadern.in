import { KeyboardSensor } from "@dnd-kit/dom";
import { isSortable } from "@dnd-kit/dom/sortable";

export class SongbookKeyboardSensor extends KeyboardSensor {
  protected handleMove(direction: "up" | "down" | "left" | "right", event: KeyboardEvent) {
    const { manager } = this;
    const { source, target } = manager.dragOperation;
    if (!source || source.data.itemType !== "section") {
      super.handleMove(direction, event);
      return;
    }
    event.preventDefault();
    if (direction !== "up" && direction !== "down") { return; }

    // The default sortable sensor ignores offscreen targets. Section headers
    // can be many songs apart, so select the next header before scrolling.
    const sections = [...manager.registry.droppables]
      .filter(isSortable)
      .filter((entry) => entry.data.itemType === "section" && entry.accepts(source))
      .sort((a, b) => a.index - b.index);
    const current = sections.findIndex((entry) => entry.id === (target?.id ?? source.id));
    const next = sections[current + (direction === "down" ? 1 : -1)];
    if (current < 0 || !next?.element) { return; }
    next.element.scrollIntoView({ block: "nearest", inline: "nearest" });
    manager.collisionObserver.disable();
    void manager.actions.setDropTarget(next.id).then((prevented) => {
      if (prevented || manager.dragOperation.source !== source || manager.dragOperation.canceled) { return; }
      const shape = manager.dragOperation.shape?.current.boundingRectangle;
      const bounds = next.element?.getBoundingClientRect();
      if (!shape || !bounds) { return; }
      // Leave the native event out: the generic sortable keyboard plugin
      // must not replace this explicit section-boundary navigation.
      manager.actions.move({ by: {
        x: bounds.left + bounds.width / 2 - shape.left - shape.width / 2,
        y: bounds.top + bounds.height / 2 - shape.top - shape.height / 2,
      } });
    }).finally(() => manager.collisionObserver.enable());
  }
}
