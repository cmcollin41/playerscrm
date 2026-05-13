import Link from "next/link";

import { Container } from "@/components/marketing/Container";
import { NavLinks } from "@/components/marketing/NavLinks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Footer() {
  return (
    <footer className="border-t border-gray-200">
      <Container>
        <div className="flex flex-col items-start justify-between gap-y-12 pb-6 pt-16 lg:flex-row lg:items-center lg:py-16">
          <div>
            <div className="flex items-center text-gray-900">
              <div className="ml-0">
                <img src="/athletes-logo.png" className="w-16" alt="Athletes App" />
              </div>
            </div>
            <nav className="mt-11 flex gap-8">
              <NavLinks />
            </nav>
          </div>
          <div className="group relative -mx-4 flex items-center self-stretch p-4 transition-colors hover:bg-gray-100 sm:self-auto sm:rounded-2xl lg:mx-0 lg:self-auto lg:p-6">
            <Link
              href="/portal-login"
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <img src="/athletes-logo.png" className="mr-2 w-6" alt="" />
              Parent Portal
            </Link>
          </div>
        </div>
        <div className="flex flex-col items-center gap-6 border-t border-gray-200 pb-12 pt-8 md:flex-row-reverse md:justify-between md:gap-0 md:pt-6">
          <form className="flex w-full max-w-md items-center gap-2 md:w-auto">
            <Input
              type="email"
              aria-label="Email address"
              placeholder="Email address"
              autoComplete="email"
              required
              className="flex-1 md:w-60"
            />
            <Button
              type="submit"
              className="flex-none bg-gray-900 font-semibold hover:bg-gray-800"
            >
              <span className="hidden lg:inline">Join our newsletter</span>
              <span className="lg:hidden">Subscribe</span>
            </Button>
          </form>
          <p className="text-sm text-gray-500">
            &copy; basketball.dev LLC {new Date().getFullYear()}. All rights
            reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
}
