/**
 * Which of the two "place" tabs (Feed, Profile) the reader was on last.
 * The Post tab is not a place: tapping it raises the composer as a sheet,
 * and closing the sheet returns here.
 */
export type PlaceTab = '/' | '/profile';

let last: PlaceTab = '/';

export function rememberTab(tab: PlaceTab): void {
  last = tab;
}

export function lastTab(): PlaceTab {
  return last;
}
