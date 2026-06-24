import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectLabel, SelectItem } from "@northstar/web";

export const Default = () => (
  <Select defaultValue="usd" open>
    <SelectTrigger className="w-[220px]"><SelectValue placeholder="Select currency" /></SelectTrigger>
    <SelectContent>
      <SelectGroup>
        <SelectLabel>Currency</SelectLabel>
        <SelectItem value="usd">US Dollar</SelectItem>
        <SelectItem value="eur">Euro</SelectItem>
        <SelectItem value="gbp">British Pound</SelectItem>
        <SelectItem value="jpy">Japanese Yen</SelectItem>
      </SelectGroup>
    </SelectContent>
  </Select>
);
