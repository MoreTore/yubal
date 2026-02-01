import { useCallback, useEffect, useRef, useState } from "react";
import { deleteCookies, getCookiesStatus, uploadCookies } from "@/api/cookies";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

interface UseCookiesReturn {
  cookiesConfigured: boolean;
  isUploading: boolean;
  isDeleting: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleDelete: () => Promise<void>;
  handleDropdownAction: (key: React.Key) => void;
  triggerFileUpload: () => void;
}

export function useCookies(isActive = true): UseCookiesReturn {
  const [cookiesConfigured, setCookiesConfigured] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isActive) return;
    getCookiesStatus()
      .then(setCookiesConfigured)
      .catch(() => {
        // Fail silently - cookies status is non-critical
      });
  }, [isActive]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isActive) return;
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      try {
        const content = await file.text();
        const success = await uploadCookies(content);

        if (success) {
          setCookiesConfigured(true);
          showSuccessToast(
            "Cookies uploaded",
            "YouTube cookies configured successfully",
          );
        } else {
          showErrorToast("Upload failed", "Failed to upload cookies file");
        }
      } catch {
        showErrorToast("Upload failed", "Could not read the file");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [isActive],
  );

  const handleDelete = useCallback(async () => {
    if (!isActive) return;
    setIsDeleting(true);
    try {
      const success = await deleteCookies();
      if (success) {
        setCookiesConfigured(false);
        showSuccessToast("Cookies deleted", "YouTube cookies removed");
      } else {
        showErrorToast("Delete failed", "Failed to delete cookies");
      }
    } catch {
      showErrorToast("Delete failed", "Could not delete cookies");
    } finally {
      setIsDeleting(false);
    }
  }, [isActive]);

  const triggerFileUpload = useCallback(() => {
    if (!isActive) return;
    fileInputRef.current?.click();
  }, [isActive]);

  const handleDropdownAction = useCallback(
    (key: React.Key) => {
      if (key === "upload") {
        triggerFileUpload();
      } else if (key === "delete") {
        handleDelete();
      }
    },
    [triggerFileUpload, handleDelete],
  );

  return {
    cookiesConfigured,
    isUploading,
    isDeleting,
    fileInputRef,
    handleFileSelect,
    handleDelete,
    handleDropdownAction,
    triggerFileUpload,
  };
}
