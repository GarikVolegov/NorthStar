import { ToggleGroup, ToggleGroupItem } from "@northstar/web";

export const Single = () => (
  <ToggleGroup type="single" defaultValue="center">
    <ToggleGroupItem value="left" aria-label="Align left">L</ToggleGroupItem>
    <ToggleGroupItem value="center" aria-label="Align center">C</ToggleGroupItem>
    <ToggleGroupItem value="right" aria-label="Align right">R</ToggleGroupItem>
  </ToggleGroup>
);

export const Multiple = () => (
  <ToggleGroup type="multiple" defaultValue={["bold", "italic"]}>
    <ToggleGroupItem value="bold" aria-label="Bold"><b>B</b></ToggleGroupItem>
    <ToggleGroupItem value="italic" aria-label="Italic"><span className="italic">I</span></ToggleGroupItem>
    <ToggleGroupItem value="underline" aria-label="Underline"><span className="underline">U</span></ToggleGroupItem>
  </ToggleGroup>
);
