import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis } from "@northstar/web";

export const Default = () => (
  <Pagination>
    <PaginationContent>
      <PaginationItem><PaginationPrevious href="#" /></PaginationItem>
      <PaginationItem><PaginationLink href="#">1</PaginationLink></PaginationItem>
      <PaginationItem><PaginationLink href="#" isActive>2</PaginationLink></PaginationItem>
      <PaginationItem><PaginationLink href="#">3</PaginationLink></PaginationItem>
      <PaginationItem><PaginationEllipsis /></PaginationItem>
      <PaginationItem><PaginationNext href="#" /></PaginationItem>
    </PaginationContent>
  </Pagination>
);
