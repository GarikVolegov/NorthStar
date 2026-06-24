import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator, CommandShortcut } from "@northstar/web";

export const Default = () => (
  <Command className="w-[400px] rounded-lg border shadow-md">
    <CommandInput placeholder="Type a command or search…" />
    <CommandList>
      <CommandEmpty>No results found.</CommandEmpty>
      <CommandGroup heading="Suggestions">
        <CommandItem>Search portfolio</CommandItem>
        <CommandItem>Create report</CommandItem>
        <CommandItem>Invite teammate</CommandItem>
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="Settings">
        <CommandItem>Profile<CommandShortcut>⌘P</CommandShortcut></CommandItem>
        <CommandItem>Billing<CommandShortcut>⌘B</CommandShortcut></CommandItem>
      </CommandGroup>
    </CommandList>
  </Command>
);
