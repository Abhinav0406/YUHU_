import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImageIcon, Upload, X, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface SelectedFile {
  id: string;
  file: File;
  preview: string;
  uploading: boolean;
  uploaded: boolean;
  url?: string;
}

const TestMultipleImages: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Filter for images only
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      toast({
        title: "Invalid file type",
        description: "Please select image files only",
        variant: "destructive"
      });
      return;
    }

    // Limit to 10 images
    if (imageFiles.length > 10) {
      toast({
        title: "Too many files",
        description: "Please select maximum 10 images at once",
        variant: "destructive"
      });
      return;
    }

    // Validate file sizes (max 5MB each)
    const oversizedFiles = imageFiles.filter(file => file.size > 5 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast({
        title: "Files too large",
        description: "Some files exceed 5MB limit. Please select smaller images.",
        variant: "destructive"
      });
      return;
    }

    // Add files to selected files with previews
    const newFiles: SelectedFile[] = imageFiles.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
      uploading: false,
      uploaded: false
    }));

    setSelectedFiles(prev => [...prev, ...newFiles]);
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return;
    
    setUploading(true);
    
    try {
      const uploadPromises = selectedFiles.map(async (fileObj) => {
        setSelectedFiles(prev => 
          prev.map(f => 
            f.id === fileObj.id ? { ...f, uploading: true } : f
          )
        );

        try {
          const fileExt = fileObj.file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
          const bucket = 'chat-files';
          
          const { data, error } = await supabase.storage.from(bucket).upload(fileName, fileObj.file);
          if (error) throw error;

          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
          
          setSelectedFiles(prev => 
            prev.map(f => 
              f.id === fileObj.id ? { ...f, uploading: false, uploaded: true, url: urlData.publicUrl } : f
            )
          );

          return urlData.publicUrl;
        } catch (error) {
          setSelectedFiles(prev => 
            prev.map(f => 
              f.id === fileObj.id ? { ...f, uploading: false } : f
            )
          );
          throw error;
        }
      });

      await Promise.all(uploadPromises);
      
      toast({
        title: "Upload complete",
        description: `Successfully uploaded ${selectedFiles.length} image${selectedFiles.length > 1 ? 's' : ''}`,
      });

    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload some files. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (fileId: string) => {
    setSelectedFiles(prev => {
      const file = prev.find(f => f.id === fileId);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== fileId);
    });
  };

  const clearAll = () => {
    selectedFiles.forEach(file => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    setSelectedFiles([]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const imageFiles = files.filter(file => file.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        const newFiles: SelectedFile[] = imageFiles.map(file => ({
          id: `${Date.now()}-${Math.random()}`,
          file,
          preview: URL.createObjectURL(file),
          uploading: false,
          uploaded: false
        }));
        setSelectedFiles(prev => [...prev, ...newFiles]);
      }
    }
  };

  // Cleanup preview URLs on unmount
  React.useEffect(() => {
    return () => {
      selectedFiles.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-6 w-6" />
            Multiple Image Upload Test
          </CardTitle>
          <CardDescription>
            Test the multiple image upload functionality with drag & drop support
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Selection */}
          <div className="space-y-4">
            <Label htmlFor="file-input">Select Images</Label>
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                isDragOver 
                  ? "border-primary bg-primary/5" 
                  : "border-muted-foreground/25 hover:border-primary/50"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">
                Drag & drop images here, or click to browse
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Supports up to 10 images, max 5MB each
              </p>
              <Button
                variant="outline"
                onClick={() => document.getElementById('file-input')?.click()}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Choose Files
              </Button>
              <input
                id="file-input"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </div>

          {/* Selected Files Preview */}
          {selectedFiles.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Selected Images ({selectedFiles.length})</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAll}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear All
                  </Button>
                  <Button
                    onClick={uploadFiles}
                    disabled={uploading || selectedFiles.some(f => !f.uploaded)}
                    className="gap-2"
                  >
                    {uploading ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Upload All
                      </>
                    )}
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {selectedFiles.map((file) => (
                  <div key={file.id} className="relative group">
                    <img
                      src={file.preview}
                      alt="Preview"
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(file.id)}
                        className="h-8 w-8 text-white hover:bg-white/20"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {file.uploading && (
                      <div className="absolute inset-0 bg-black/30 rounded-lg flex items-center justify-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      </div>
                    )}
                    {file.uploaded && (
                      <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    <div className="mt-2 text-xs text-muted-foreground truncate">
                      {file.file.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Uploaded URLs */}
          {selectedFiles.some(f => f.uploaded) && (
            <div className="space-y-4">
              <Label>Uploaded URLs</Label>
              <div className="space-y-2">
                {selectedFiles
                  .filter(f => f.uploaded && f.url)
                  .map((file) => (
                    <div key={file.id} className="flex items-center gap-2 p-2 bg-muted rounded">
                      <span className="text-xs font-mono flex-1 truncate">
                        {file.url}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(file.url!)}
                        className="h-6 px-2 text-xs"
                      >
                        Copy
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TestMultipleImages;
