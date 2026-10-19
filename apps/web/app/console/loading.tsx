import { Loader } from "@krizaka/ui/loader";
import { Skeleton } from "@krizaka/ui/skeleton";

/**
 * While a screen asks Orochia for its figures: the shape of a console page (heading, four figures, a panel) in
 * skeletons, and the wait in words once it lasts (the Loader shows after 250 ms, never blinks).
 */
export default function Loading() {
  return (
    <div aria-busy="true">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} shape="rect" className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="relative">
        <Skeleton shape="rect" className="h-72 rounded-2xl" />
        <Loader variant="overlay" label="Asking Orochia for the figures" />
      </div>
    </div>
  );
}
