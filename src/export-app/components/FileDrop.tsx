import { useState } from "react";

interface Props {
  onPick: (path: string) => void;
  disabled?: boolean;
}

export function FileDrop({ onPick, disabled }: Props) {
  const [drag, setDrag] = useState(false);

  const choose = async () => {
    if (disabled) {
      return;
    }
    const picked = await window.api.pickMscz();
    if (picked) {
      onPick(picked);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (disabled) {
      return;
    }
    const file = e.dataTransfer.files[0];
    if (!file) {
      return;
    }
    const path = window.api.getDroppedPath(file);
    if (path.toLowerCase().endsWith(".mscz")) {
      onPick(path);
    }
  };

  return (
    <div
      className={`dropzone${drag ? " drag" : ""}${disabled ? " disabled" : ""}`}
      onClick={() => void choose()}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) {
          setDrag(true);
        }
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
    >
      Arraste um arquivo <strong>.mscz</strong> aqui
      <br />
      ou clique para escolher
    </div>
  );
}
