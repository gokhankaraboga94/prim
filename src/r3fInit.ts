import { extend } from "@react-three/fiber";
import * as THREE from "three";

/** One THREE instance for R3F + app code (Vite must dedupe `three`). */
extend(THREE);
