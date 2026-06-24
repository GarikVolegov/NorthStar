import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption } from "@northstar/web";

export const Default = () => (
  <div className="w-[480px]">
    <Table>
      <TableCaption>Recent invoices</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow><TableCell className="font-medium">INV-001</TableCell><TableCell>Paid</TableCell><TableCell className="text-right">€250.00</TableCell></TableRow>
        <TableRow><TableCell className="font-medium">INV-002</TableCell><TableCell>Pending</TableCell><TableCell className="text-right">€150.00</TableCell></TableRow>
        <TableRow><TableCell className="font-medium">INV-003</TableCell><TableCell>Overdue</TableCell><TableCell className="text-right">€350.00</TableCell></TableRow>
      </TableBody>
    </Table>
  </div>
);
