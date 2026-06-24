import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@northstar/web";

export const Default = () => (
  <Accordion type="single" collapsible defaultValue="item-1" className="w-[420px]">
    <AccordionItem value="item-1">
      <AccordionTrigger>What is North Star?</AccordionTrigger>
      <AccordionContent>A guided platform for tracking and growing your portfolio.</AccordionContent>
    </AccordionItem>
    <AccordionItem value="item-2">
      <AccordionTrigger>Is my data secure?</AccordionTrigger>
      <AccordionContent>Yes — everything is encrypted in transit and at rest.</AccordionContent>
    </AccordionItem>
    <AccordionItem value="item-3">
      <AccordionTrigger>Can I cancel anytime?</AccordionTrigger>
      <AccordionContent>Absolutely. There are no long-term commitments.</AccordionContent>
    </AccordionItem>
  </Accordion>
);
