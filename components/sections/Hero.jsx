import { Map, Zap } from "lucide-react";
import BadgeSpan from "../ui/badge-span";
import { Button } from "../ui/button";
import Image from "next/image";

export default function Hero() {
  return (
    <section
      id="main"
      className="px-6 md:px-16 lg:px-20 py-10 min-h-screen flex items-center"
    >
      <div className="grid md:grid-cols-2 gap-4 items-center w-full">
        {/* Left side content */}
        <div className="space-y-4 text-center md:text-left">
          <BadgeSpan title="Flash Carpooling" icon={Zap} />
          <h1 className="text-3xl font-semibold leading-tight">
            Connect with Drivers and Riders in Your Network
          </h1>
          <p className="text-para">
            MHSPRide makes it easy to coordinate rides to the mountain, connect with fellow patrollers, and cut down on solo commutes.
          </p>
          <Button href='/dashboard' className="bg-mainColor dark:text-white dark:hover:!text-black transition duration-300 ease-in">
            Book your ride
            <Map/>
          </Button>
        </div>

        
        <div className="flex justify-end">
          <div>
            <Image src='/assets/mhsp_hero_logo.png' alt='MHSP Hero' width={750} height={750}></Image>
          </div>
        </div>
      </div>
    </section>
  );
}
