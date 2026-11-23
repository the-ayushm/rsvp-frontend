import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "./reduxStore";

/**
 * Typed version of `useDispatch` — use this instead of the plain hook
 * so that TypeScript knows about all your async thunks.
 */
export const useAppDispatch = () => useDispatch<AppDispatch>();

/**
 * Typed version of `useSelector` — use this instead of the plain hook
 * so that TypeScript infers state shape automatically.
 */
export const useAppSelector = <T>(selector: (state: RootState) => T): T =>
  useSelector<RootState, T>(selector);
