import Shopr from '../(tabs)/Shopr';

// Re-export the Shopr screen at /market so Admin -> View listings and other routes
// have a canonical place for the marketplace listing.
export default function MarketIndex() {
  return <Shopr /> as any;
}
