import { useState } from 'react';
import { useUser } from '@clerk/react';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AlertCircle, Database, RefreshCw, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { connectSyntheticData, uploadDataset } from '@/features/market/api/bi-api';

export default function ConnectData() {
  const { toast } = useToast();
  const { user } = useUser();
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [datasetName, setDatasetName] = useState('Custom Dataset');
  const [productsFile, setProductsFile] = useState<File | null>(null);
  const [salesFile, setSalesFile] = useState<File | null>(null);
  const [stockFile, setStockFile] = useState<File | null>(null);
  const [investmentsFile, setInvestmentsFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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

  const handleUpload = async () => {
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to upload datasets.', variant: 'destructive' });
      return;
    }

    if (!productsFile || !salesFile || !stockFile || !investmentsFile) {
      toast({ title: 'Missing files', description: 'Upload all four files before continuing.', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    try {
      await uploadDataset(user.id, {
        datasetName: datasetName.trim() || 'Custom Dataset',
        products: productsFile,
        sales: salesFile,
        stock: stockFile,
        investments: investmentsFile,
      });
      toast({ title: 'Dataset uploaded', description: 'Your dataset is now connected and ready for analysis.' });
      setProductsFile(null);
      setSalesFile(null);
      setStockFile(null);
      setInvestmentsFile(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload.';
      setUploadError(message);
      toast({ title: 'Upload failed', description: message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
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
              Use the synthetic supermarket dataset or upload your own CSV files.
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
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Upload Custom Dataset</h2>
                <p className="text-sm text-muted-foreground">
                  Upload four files (products, sales, stock, investments). CSV or Excel.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Dataset name</label>
                <Input value={datasetName} onChange={(event) => setDatasetName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Products file</label>
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(event) => setProductsFile(event.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Sales file</label>
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(event) => setSalesFile(event.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Stock file</label>
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(event) => setStockFile(event.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Investments file</label>
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(event) => setInvestmentsFile(event.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
              Required columns mirror the synthetic dataset headers (sku, name, category, price, cost, date, revenue,
              discount, payment_method, store_city, reorder_point, expected_roi, actual_roi, etc.).
            </div>

            {uploadError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-red-800">AI processing failed</p>
                    <p className="text-red-700">{uploadError}</p>
                    <p className="text-red-600 text-xs">
                      Please verify your files have the required columns (sku, name, category, price, revenue, etc.) and try again. If the issue persists, try using the synthetic dataset instead.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleUpload} disabled={isUploading}>
                {isUploading ? 'Uploading...' : 'Upload Dataset'}
              </Button>
              {uploadError && (
                <Button variant="outline" onClick={() => { setUploadError(null); setDatasetName('Custom Dataset'); }}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              )}
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
