"use client";

import React, { useRef, useState, useCallback } from "react";
import { UploadCloud } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { useUploadDocument } from "@/lib/queries/documents";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export function DocumentUploadZone() {
  const { activeWorkspace } = useWorkspace();
  const { mutate: uploadDocument, isPending } = useUploadDocument();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback((files: FileList | File[]) => {
    if (!activeWorkspace) {
      setError("Please select a workspace first.");
      return;
    }

    setError(null);

    const validFiles: File[] = [];
    const newErrors: string[] = [];

    Array.from(files).forEach((file) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        newErrors.push(`${file.name} is not a supported file type (PDF/DOCX only).`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        newErrors.push(`${file.name} exceeds the 25MB limit.`);
        return;
      }
      validFiles.push(file);
    });

    if (newErrors.length > 0) {
      setError(newErrors.join(" "));
    }

    validFiles.forEach((file) => {
      uploadDocument({ file, workspaceId: activeWorkspace.id });
    });
  }, [activeWorkspace, uploadDocument]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      // Reset input so the same file can be selected again if needed
      e.target.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl cursor-pointer transition-colors duration-200 ease-in-out ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
        }`}
      >
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className={`p-4 rounded-full ${isDragging ? "bg-primary/10" : "bg-muted"}`}>
            <UploadCloud className={`w-8 h-8 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <div>
            <p className="text-sm font-medium">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF or DOCX (max 25MB)
            </p>
          </div>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileInputChange}
          className="hidden"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
        />
      </div>
      
      {error && (
        <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
          {error}
        </div>
      )}
    </div>
  );
}
