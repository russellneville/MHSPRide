/**
 * Predefined pickup/dropoff locations for the MHSPRide carpooling app.
 * Coordinates obtained via Google Maps Geocoding API.
 */

export const LOCATIONS = [
  {
    id: "powell-butte",
    name: "Powell Butte Park & Ride",
    address: "SE 162nd Ave & SE Powell Blvd, Portland OR 97236",
    lat: 45.4947932,
    lon: -122.4966988,
    googleMapsUrl:
      "https://www.google.com/maps/search/?api=1&query=45.4947932,-122.4966988",
    appleMapsUrl:
      "https://maps.apple.com/?ll=45.4947932,-122.4966988&q=Powell%20Butte%20Park%20%26%20Ride",
  },
  {
    id: "clackamas-tc",
    name: "Clackamas Town Center MAX Park & Ride",
    address: "SE 82nd Ave & Sunnyside Rd, Clackamas OR 97015",
    lat: 45.4331658,
    lon: -122.579242,
    googleMapsUrl:
      "https://www.google.com/maps/search/?api=1&query=45.4331658,-122.579242",
    appleMapsUrl:
      "https://maps.apple.com/?ll=45.4331658,-122.579242&q=Clackamas%20Town%20Center%20MAX%20Park%20%26%20Ride",
  },
  {
    id: "troutdale-fred-meyer",
    name: "Troutdale Fred Meyer",
    address: "1500 NW Graham Rd, Troutdale OR 97060",
    lat: 45.5515379,
    lon: -122.3880687,
    googleMapsUrl:
      "https://www.google.com/maps/search/?api=1&query=45.5515379,-122.3880687",
    appleMapsUrl:
      "https://maps.apple.com/?ll=45.5515379,-122.3880687&q=Troutdale%20Fred%20Meyer",
  },
  {
    id: "sandy-fred-meyer",
    name: "Sandy Fred Meyer",
    address: "37555 OR-211, Sandy OR 97055",
    lat: 45.3895446,
    lon: -122.2634993,
    googleMapsUrl:
      "https://www.google.com/maps/search/?api=1&query=45.3895446,-122.2634993",
    appleMapsUrl:
      "https://maps.apple.com/?ll=45.3895446,-122.2634993&q=Sandy%20Fred%20Meyer",
  },
  {
    id: "sandy-safeway",
    name: "Sandy Safeway",
    address: "37530 US-26, Sandy OR 97055",
    lat: 45.3973402,
    lon: -122.2683607,
    googleMapsUrl:
      "https://www.google.com/maps/search/?api=1&query=45.3973402,-122.2683607",
    appleMapsUrl:
      "https://maps.apple.com/?ll=45.3973402,-122.2683607&q=Sandy%20Safeway",
  },
  {
    id: "zigzag-ranger-station",
    name: "Zigzag Ranger Station",
    address: "70220 E US-26, Zigzag OR 97049",
    lat: 45.3428437,
    lon: -121.9415786,
    googleMapsUrl:
      "https://www.google.com/maps/search/?api=1&query=45.3428437,-121.9415786",
    appleMapsUrl:
      "https://maps.apple.com/?ll=45.3428437,-121.9415786&q=Zigzag%20Ranger%20Station",
  },
  {
    id: "hoodland-thriftway",
    name: "Hoodland Thriftway",
    address: "68280 US-26, Welches OR 97067",
    lat: 45.3476142,
    lon: -121.9628787,
    googleMapsUrl:
      "https://www.google.com/maps/search/?api=1&query=45.3476142,-121.9628787",
    appleMapsUrl:
      "https://maps.apple.com/?ll=45.3476142,-121.9628787&q=Hoodland%20Thriftway",
  },
  {
    id: "chevron-govt-camp",
    name: "Chevron Government Camp",
    address: "90149 Government Camp Loop, Government Camp OR 97028",
    lat: 45.302644,
    lon: -121.7466654,
    googleMapsUrl:
      "https://www.google.com/maps/search/?api=1&query=45.302644,-121.7466654",
    appleMapsUrl:
      "https://maps.apple.com/?ll=45.302644,-121.7466654&q=Chevron%20Government%20Camp",
  },
  {
    id: "buzz-bowman-center",
    name: "Buzz Bowman Center",
    address: "87622 Government Camp Loop, Government Camp OR 97028",
    lat: 45.3048918,
    lon: -121.7590055,
    googleMapsUrl:
      "https://www.google.com/maps/search/?api=1&query=45.3048918,-121.7590055",
    appleMapsUrl:
      "https://maps.apple.com/?ll=45.3048918,-121.7590055&q=Buzz%20Bowman%20Center",
  },
  {
    id: "hood-river-safeway",
    name: "Hood River Westside Safeway",
    address: "2249 Cascade Ave, Hood River OR 97031",
    lat: 45.7087368,
    lon: -121.5349924,
    googleMapsUrl:
      "https://www.google.com/maps/search/?api=1&query=45.7087368,-121.5349924",
    appleMapsUrl:
      "https://maps.apple.com/?ll=45.7087368,-121.5349924&q=Hood%20River%20Westside%20Safeway",
  },
  {
    id: "timberline-lodge",
    name: "Timberline Lodge",
    address: "Timberline Lodge, Government Camp OR 97028",
    lat: 45.3311281,
    lon: -121.7110064,
    googleMapsUrl:
      "https://www.google.com/maps/search/?api=1&query=45.3311281,-121.7110064",
    appleMapsUrl:
      "https://maps.apple.com/?ll=45.3311281,-121.7110064&q=Timberline%20Lodge",
  },
];

export const DEFAULT_DESTINATION = "timberline-lodge";

/**
 * Returns the display name for a location by its id slug.
 * Returns undefined if the id is not found.
 * @param {string} id - Location slug
 * @returns {string|undefined}
 */
export function getLocationName(id) {
  return LOCATIONS.find((loc) => loc.id === id)?.name;
}
