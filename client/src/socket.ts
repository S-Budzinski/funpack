import { io } from "socket.io-client";
import { getApiUrl } from "./api";

export const socket = io(getApiUrl(), { autoConnect: false });
