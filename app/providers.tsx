"use client";

import { Toaster } from "sonner";
import { ModalProvider } from "@/components/modal/provider";
import { Next13ProgressBar } from "next13-progressbar";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Toaster className="dark:hidden" />
      <Toaster theme="dark" className="hidden dark:block" />
      <Next13ProgressBar
        height="3px"
        color="#16a34a"
        options={{ 
          showSpinner: false,
          easing: 'ease',
          speed: 500,
          trickleSpeed: 200,
        }}
        showOnShallow
      />
      
      <ModalProvider>{children}</ModalProvider>
   
    </>
  );
}
