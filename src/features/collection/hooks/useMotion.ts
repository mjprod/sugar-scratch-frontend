/**
 * Public hook entry for the global motion system.
 * Prefer importing from here so consumers stay decoupled from the provider file.
 */
export {
  useMotion,
  useMotionOptional,
  type MotionPermission,
  type MotionValues,
} from '../context/MotionContext'
