import { useState } from 'react';
import { useUser } from '@clerk/react';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AlertCircle, Database, RefreshCw, Sparkles, FileText, Upload, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { connectSyntheticData, uploadNormalizedDataset } from '@/features/market/api/bi-api';
import { parseDocument, ExtractionResult } from '@/features/market/utils/document-extractor';
import { MappingPreviewModal } from '@/features/market/components/MappingPreviewModal';
import type { SalesRow, ProductRow, StockRow, InvestmentRow } from '@/features/market/utils/market-metrics-core';

export default function ConnectData() {
  const { toast } = useToast();
  const { user } = useUser();
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [datasetName, setDatasetName] = useState('Custom Dataset');
  const [isParsing, setIsParsing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Universal File Upload States
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [extractionResults, setExtractionResults] = useState<ExtractionResult[]>([]);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  const handleConnect = async (datasetId: 'dataset1' | 'dataset2') => {
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to connect data sources.', variant: 'destructive' });
      return;
    }

    setIsConnecting(datasetId);
    try {
      const result = await connectSyntheticData(user.id, datasetId);
      if (result.ok) {
        setConnected(true);
        toast({ title: 'Synthetic dataset connected', description: 'You can now run auto-analysis from the dashboard.' });
      }
    } catch (error) {
      toast({ title: 'Connection failed', description: error instanceof Error ? error.message : 'Failed to connect.', variant: 'destructive' });
    } finally {
      setIsConnecting(null);
    }
  };

  const handleFileChange = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    setUploadedFiles(fileArray);
    setUploadError(null);

    setIsParsing(true);
    try {
      toast({ title: 'Extracting data', description: `Parsing ${fileArray.length} file(s)...` });
      const parsedResults = await Promise.all(fileArray.map((f) => parseDocument(f)));
      setExtractionResults(parsedResults);
      setIsPreviewModalOpen(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to parse uploaded documents.';
      setUploadError(msg);
      toast({ title: 'Extraction failed', description: msg, variant: 'destructive' });
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmNormalized = async (normalized: {
    sales: SalesRow[];
    products: ProductRow[];
    stock: StockRow[];
    investments: InvestmentRow[];
  }) => {
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to upload datasets.', variant: 'destructive' });
      return;
    }

    try {
      setIsParsing(true);
      await uploadNormalizedDataset(user.id, datasetName.trim() || 'Custom Dataset', normalized);
      toast({
        title: 'Dataset Connected & Normalized!',
        description: `Successfully loaded ${normalized.sales.length} sales, ${normalized.products.length} products, ${normalized.stock.length} stock items.`,
      });
      setUploadedFiles([]);
      setExtractionResults([]);
      setConnected(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to upload dataset.';
      setUploadError(msg);
      toast({ title: 'Upload failed', description: msg, variant: 'destructive' });
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <DashboardSidebar />

      <div className="flex-1">
        <main className="container py-10 space-y-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Connect Your Data</h1>
            <p className="text-muted-foreground">
              Connect synthetic retail datasets or upload your own files in any format (CSV, Excel, JSON, XML, PDF, Word).
            </p>
          </div>

          <Card className="p-6 space-y-4 card-elevated">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Synthetic Supermarket Dataset (Prototype)</h2>
                <p className="text-sm text-muted-foreground">
                  Preloaded products, sales, stock, and investments for BI testing.
                </p>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
              {connected
                ? 'Connected. You are ready to run auto-analysis from the dashboard.'
                : 'Connect the synthetic dataset to start generating decisions.'}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => handleConnect('dataset1')} disabled={isConnecting !== null || connected} variant="default">
                <Sparkles className="h-4 w-4 mr-2" />
                {isConnecting === 'dataset1' ? 'Connecting...' : 'Connect Dataset 1'}
              </Button>
              <Button onClick={() => handleConnect('dataset2')} disabled={isConnecting !== null || connected} variant="secondary">
                <Sparkles className="h-4 w-4 mr-2" />
                {isConnecting === 'dataset2' ? 'Connecting...' : 'Connect Dataset 2'}
              </Button>
            </div>
          </Card>

          <Card className="p-6 space-y-4 card-elevated">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">AI Universal File Uploader & Schema Mapper</h2>
                <p className="text-sm text-muted-foreground">
                  Upload ANY retail dataset in ANY format (CSV, XLSX, JSON, XML, PDF, DOCX, TXT). AI will automatically map headers & normalize data.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2 max-w-md">
                <label className="text-sm font-medium">Dataset name</label>
                <Input value={datasetName} onChange={(event) => setDatasetName(event.target.value)} />
              </div>

              <div className="border-2 border-dashed rounded-xl p-8 text-center bg-muted/10 hover:bg-muted/20 transition-colors cursor-pointer space-y-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold text-base">Drag & drop files or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports `.csv`, `.xlsx`, `.xls`, `.json`, `.xml`, `.pdf`, `.docx`, `.txt`. Single multi-sheet Excel files or multiple separate files accepted.
                  </p>
                </div>
                <Input
                  type="file"
                  multiple
                  accept=".csv,.xlsx,.xls,.json,.xml,.pdf,.docx,.txt"
                  className="hidden"
                  id="universal-file-input"
                  onChange={(e) => handleFileChange(e.target.files)}
                />
                <Button variant="secondary" onClick={() => document.getElementById('universal-file-input')?.click()} disabled={isParsing}>
                  {isParsing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Parsing Files & Auto-Mapping...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Select Files to Upload
                    </>
                  )}
                </Button>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>Selected Files ({uploadedFiles.length})</span>
                    <Button size="sm" onClick={() => setIsPreviewModalOpen(true)}>
                      <Sparkles className="h-3.5 w-3.5 mr-1 text-primary" />
                      Open Schema Mapping Preview
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {uploadedFiles.map((f) => (
                      <div key={f.name} className="bg-background border rounded-md px-3 py-1 text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        <span className="font-medium">{f.name}</span>
                        <span className="text-muted-foreground">({(f.size / 1024).toFixed(1)} KB)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {uploadError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-red-800">Processing failed</p>
                    <p className="text-red-700">{uploadError}</p>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </main>
      </div>

      <MappingPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        extractionResults={extractionResults}
        onConfirm={handleConfirmNormalized}
      />
    </div>
  );
}
