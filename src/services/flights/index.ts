import { listAirlinesTool, listAirlinesHandler } from "./tools/airlines.js";
import { flightSearchTool, flightSearchHandler } from "./tools/search.js";
import { flightSearchMultiCityTool, flightSearchMultiCityHandler } from "./tools/multi_city.js";
import type { ServiceModule } from "../../types.js";

const flightsService: ServiceModule = {
  name: "flights",
  scopes: [],
  tools: [listAirlinesTool, flightSearchTool, flightSearchMultiCityTool],
  handlers: {
    flight_list_airlines: listAirlinesHandler,
    flight_search: flightSearchHandler,
    flight_search_multi_city: flightSearchMultiCityHandler,
  },
};

export default flightsService;
