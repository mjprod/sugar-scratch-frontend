import { useCallback, useRef } from "react";
import { EffectCoverflow } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperClass } from "swiper/types";
import type { Iteration } from "@/features/packs/types";
import "swiper/css";
import "swiper/css/effect-coverflow";
import "./MobileCssCarousel.css";

export function MobileCssCarousel({ items }: { items: Iteration[] }) {
  const videosRef = useRef<Array<HTMLVideoElement | null>>([]);

  const syncPlayback = useCallback((next: number) => {
    videosRef.current.forEach((video, index) => {
      if (!video) return;
      if (index === next) {
        void video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, []);

  function onSwiper(swiper: SwiperClass) {
    videosRef.current.length = items.length;
    syncPlayback(swiper.activeIndex);
  }

  return (
    <Swiper
      className="mobile-css-carousel"
      modules={[EffectCoverflow]}
      effect="coverflow"
      grabCursor
      centeredSlides
      slidesPerView="auto"
      coverflowEffect={{
        rotate: 50,
        stretch: 0,
        depth: 100,
        modifier: 1,
        slideShadows: true,
      }}
      onSwiper={onSwiper}
      onSlideChange={(swiper) => syncPlayback(swiper.activeIndex)}
    >
      {items.map((item, index) => (
        <SwiperSlide key={item.id}>
          <video
            ref={(node) => {
              videosRef.current[index] = node;
            }}
            src={item.videoUrl || undefined}
            muted
            loop
            playsInline
            autoPlay={index === 0}
            preload={index === 0 ? "auto" : "metadata"}
          />
        </SwiperSlide>
      ))}
    </Swiper>
  );
}
