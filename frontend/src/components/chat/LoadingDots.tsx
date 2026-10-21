import { Loader } from '@/components/motion/loader';

export const LoadingDots = () => (
  <Loader
    variant="dots"
    size={6}
    speed={0.9}
    label="Responding"
    className="text-muted-foreground"
  />
);
