import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { afterEach, expect, it, vi } from "vitest";
import { arrangementMusicXml } from "./parts";

afterEach(() => {vi.unstubAllGlobals();});

it("labels arrangement staves and removes fingerings while keeping other markings", () => {
  vi.stubGlobal("DOMParser", DOMParser);
  vi.stubGlobal("XMLSerializer", XMLSerializer);
  const xml = `<score-partwise><part-list>
    <score-part id="P1"><part-name print-object="no">Old label</part-name>
      <part-name-display><display-text>Custom label</display-text></part-name-display></score-part>
    <score-part id="P2"><part-name>Another label</part-name></score-part>
  </part-list>
  <part id="P1"><measure>
    <direction><direction-type><words>&lt;font size="9"/&gt;123</words></direction-type></direction>
    <direction><direction-type><rehearsal>1</rehearsal></direction-type></direction>
    <direction><direction-type><words>100</words></direction-type><sound tempo="100"/></direction>
    <note><notations><technical><fingering>3</fingering><up-bow/></technical></notations></note>
  </measure></part>
  <part id="P2"><measure><note><notations><technical><pluck>2</pluck></technical></notations></note></measure></part>
  </score-partwise>`;
  const markup = arrangementMusicXml(xml, new Map([["P1", "Trompete"], ["P2", "Tuba Eb"]]));
  expect(markup).toContain("<part-name>Trompete</part-name><part-abbreviation>Trompete</part-abbreviation>");
  expect(markup).toContain("<part-name>Tuba Eb</part-name>");
  expect(markup).not.toMatch(/Custom label|123|<fingering|<pluck/);
  expect(markup).toContain("<rehearsal>1</rehearsal>");
  expect(markup).toContain('<sound tempo="100"/>');
  expect(markup).toContain("<up-bow/>");
});
