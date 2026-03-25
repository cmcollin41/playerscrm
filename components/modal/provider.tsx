"use client";

import { ReactNode, createContext, useContext, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import useWindowSize from "@/lib/hooks/use-window-size";

interface ModalContextProps {
  show: (content: ReactNode, options?: ModalOptions) => void;
  hide: () => void;
  isModalOpen: boolean;
  updateModalContent: (content: ReactNode) => void;
}

interface ModalOptions {
  title?: string;
  description?: string;
}

const ModalContext = createContext<ModalContextProps | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modalContent, setModalContent] = useState<ReactNode | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalOptions, setModalOptions] = useState<ModalOptions>({});
  const { isMobile } = useWindowSize();

  const show = (content: ReactNode, options?: ModalOptions) => {
    setModalContent(content);
    setModalOptions(options || {});
    setShowModal(true);
  };

  const hide = () => {
    setShowModal(false);
    setTimeout(() => {
      setModalContent(null);
      setModalOptions({});
    }, 300);
  };

  const updateModalContent = (content: ReactNode) => {
    setModalContent(content);
  };

  return (
    <ModalContext.Provider
      value={{ show, hide, isModalOpen: showModal, updateModalContent }}
    >
      {children}
      
      {/* Desktop: Use Dialog */}
      {!isMobile && (
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0">
            {modalOptions.title && (
              <DialogHeader>
                {modalOptions.title && <DialogTitle>{modalOptions.title}</DialogTitle>}
                {modalOptions.description && (
                  <DialogDescription>{modalOptions.description}</DialogDescription>
                )}
              </DialogHeader>
            )}
            {modalContent}
          </DialogContent>
        </Dialog>
      )}
      
      {/* Mobile: Use Sheet */}
      {isMobile && (
        <Sheet open={showModal} onOpenChange={setShowModal}>
          <SheetContent side="bottom" className="max-h-[90vh]">
            {modalOptions.title && (
              <SheetHeader>
                {modalOptions.title && <SheetTitle>{modalOptions.title}</SheetTitle>}
                {modalOptions.description && (
                  <SheetDescription>{modalOptions.description}</SheetDescription>
                )}
              </SheetHeader>
            )}
            {modalContent}
          </SheetContent>
        </Sheet>
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  return useContext(ModalContext);
}
