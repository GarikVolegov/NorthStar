import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, Card, CardContent } from "@northstar/web";

export const Default = () => (
  <div className="px-12">
    <Carousel className="w-[260px]">
      <CarouselContent>
        {[1, 2, 3].map((n) => (
          <CarouselItem key={n}>
            <Card><CardContent className="flex aspect-square items-center justify-center p-6"><span className="text-4xl font-semibold">{n}</span></CardContent></Card>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  </div>
);
