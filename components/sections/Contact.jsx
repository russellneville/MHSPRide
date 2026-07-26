import { Send, User } from "lucide-react";
import BadgeSpan from "../ui/badge-span";
import { Card, CardContent } from "../ui/card";
import { Label } from "@radix-ui/react-label";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { TEXTAREA_MAX_LENGTH } from "@/lib/utils";

export default function Contact() {
  return (
    <section
      id="contact"
      className="relative px-6 md:px-16 lg:px-20 py-10 min-h-screen flex justify-center items-center bg-[url('/assets/support.png')] bg-cover bg-center"
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-mainColor/73"></div>

      <div className="relative grid md:grid-cols-2 gap-6 items-center w-full max-w-6xl">
        <div className="space-y-4 text-center md:text-left text-white">
          <BadgeSpan title="Support 24/7" icon={User} />
          <h3 className="text-2xl sm:text-3xl md:text-5xl">
            Have a Questions? Our Support listens to you
          </h3>
        </div>
        <Card className="w-full">
          <CardContent>
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="inline-block">Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="inline-block">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className="space-y-2" >
                <Label htmlFor="message" className="inline-block">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Your message"
                  required
                  className="resize-none h-40"
                  rows={5}
                  maxLength={TEXTAREA_MAX_LENGTH}
                />
              </div>

              <Button type="submit" className="bg-mainColor dark:text-white hover:!text-black transition duration-300 ease-in">
                Send Message
                <Send/>
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
