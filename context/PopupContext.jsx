"use client";
import { createContext, useContext, useState } from "react";

const PopupContext = createContext();

export const PopupProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState(null);
  const [title, setTitle] = useState(null);
  // Generic scratch space a popup's title and content can both read/write via
  // usePopup() — e.g. so a dropdown embedded in the title bar (which is a
  // separate element tree from the content) can share selection state with
  // the form below it. Reset on every open/close so it never leaks between
  // different popups.
  const [popupState, setPopupState] = useState(null);

  const openPopup = (title , popupContent) => {
    setTitle(title);
    setContent(popupContent);
    setPopupState(null);
    setIsOpen(true);
  };

  const closePopup = () => {
    setContent(null);
    setIsOpen(false);
    setPopupState(null);
  };

  return (
    <PopupContext.Provider value={{ isOpen, content, title , openPopup, closePopup, popupState, setPopupState }}>
      {children}
    </PopupContext.Provider>
  );
};

export const usePopup = () => useContext(PopupContext);
