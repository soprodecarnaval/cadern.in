export interface MetadataValues {
  title: string;
  composer: string;
  previousSource: string;
  poet: string;
}

interface Props {
  value: MetadataValues;
  onChange: (value: MetadataValues) => void;
}

const fields: Array<{
  key: keyof MetadataValues;
  label: string;
  mapping: string;
}> = [
  { key: "title", label: "Título", mapping: "nome do arquivo" },
  { key: "composer", label: "Compositor", mapping: "composer" },
  { key: "previousSource", label: "Trecho", mapping: "previousSource" },
  { key: "poet", label: "Tags", mapping: "poet" },
];

export function MetadataForm({ value, onChange }: Props) {
  return (
    <section className="metadata-form">
      <h2>Metadados</h2>
      {fields.map((field) => (
        <label key={field.key}>
          <span>
            {field.label}
            <small>cadern.in: {field.mapping}</small>
          </span>
          <input
            value={value[field.key]}
            onChange={(event) =>
              onChange({ ...value, [field.key]: event.target.value })
            }
          />
        </label>
      ))}
    </section>
  );
}
