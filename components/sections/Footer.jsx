'use client';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-background border-t border-border">
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* About */}
        <div>
            <div className="mb-5">
                <Image className='dark:hidden' src='/assets/mhsp_title_logo.png' alt="logo" height={35} width={125}></Image>
                <Image className='hidden dark:block' src='/assets/mhsp_title_logo.png' alt="logo" height={35} width={125}></Image>
            </div>
          <p className="text-sm">
            Building modern web experiences with Next.js and Shadcn UI.
          </p>
        </div>

        {/* Links */}
        <div>
          <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
          <ul className="space-y-2">
            <li><a href="/" className="hover:underline">Home</a></li>
            <li><a href="/about" className="hover:underline">About</a></li>
            <li><a href="/services" className="hover:underline">Services</a></li>
            <li><a href="/contact" className="hover:underline">Contact</a></li>
          </ul>
        </div>

        {/* Newsletter */}
        <div>
          <h4 className="text-lg font-semibold mb-4">Subscribe</h4>
          <p className="text-sm mb-4">Get our latest updates and news.</p>
            <div className="flex items-center gap-3">
            <Input placeholder="Your email" className="flex-1" />
            <Button>Subscribe</Button>
            </div>
              
           
          <div className="flex gap-4 mt-4">
            <a href="#" aria-label="Twitter" className="hover:text-blue-500">X</a>
            <a href="#" aria-label="GitHub" className="hover:text-gray-900 dark:hover:text-white">I</a>
            <a href="#" aria-label="Instagram" className="hover:text-pink-500">A</a>
          </div>
        </div>
      </div>

      <div className="text-center py-6 text-sm border-t border-gray-300 dark:border-gray-700">
        © {new Date().getFullYear()} MyWebsite. All rights reserved.
      </div>
    </footer>
  );
}
