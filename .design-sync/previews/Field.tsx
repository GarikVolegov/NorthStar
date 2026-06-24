import { FieldSet, FieldLegend, FieldGroup, Field, FieldLabel, FieldDescription, Input } from "@northstar/web";

export const Default = () => (
  <FieldSet className="w-[360px]">
    <FieldLegend>Billing details</FieldLegend>
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="card">Card number</FieldLabel>
        <Input id="card" placeholder="4242 4242 4242 4242" />
        <FieldDescription>We never store your full card number.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="zip">Billing ZIP</FieldLabel>
        <Input id="zip" placeholder="94107" />
      </Field>
    </FieldGroup>
  </FieldSet>
);
