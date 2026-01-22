import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import { ReceiptData } from './POSSplitPaymentModal';

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    textAlign: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 8,
    color: '#666',
    marginBottom: 3,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    borderBottomStyle: 'dashed',
    marginVertical: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  itemName: {
    flex: 1,
    fontSize: 9,
  },
  itemQty: {
    width: 30,
    textAlign: 'center',
    fontSize: 9,
  },
  itemPrice: {
    width: 50,
    textAlign: 'right',
    fontSize: 9,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
    paddingTop: 5,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  footer: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 8,
    color: '#666',
  },
  paymentInfo: {
    backgroundColor: '#f5f5f5',
    padding: 8,
    marginTop: 10,
    borderRadius: 4,
  },
});

interface POSReceiptPDFProps {
  data: ReceiptData;
  restaurantName?: string;
  restaurantAddress?: string;
  restaurantNIF?: string;
}

// PDF Document Component
export function POSReceiptDocument({ 
  data, 
  restaurantName = 'Josephine Restaurant',
  restaurantAddress = 'Calle Gran Vía, 123, Madrid',
  restaurantNIF = 'B12345678',
}: POSReceiptPDFProps) {
  return (
    <Document>
      <Page size={[226.77, 'auto']} style={styles.page}> {/* 80mm width */}
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{restaurantName}</Text>
          <Text style={styles.subtitle}>{restaurantAddress}</Text>
          <Text style={styles.subtitle}>NIF: {restaurantNIF}</Text>
        </View>

        <View style={styles.divider} />

        {/* Ticket Info */}
        <View style={styles.row}>
          <Text>Ticket: {data.ticketNumber}</Text>
          <Text>{data.date}</Text>
        </View>
        <View style={styles.row}>
          <Text>Mesa: {data.tableName}</Text>
        </View>

        <View style={styles.divider} />

        {/* Items Header */}
        <View style={styles.itemRow}>
          <Text style={[styles.itemName, { fontWeight: 'bold' }]}>Descripción</Text>
          <Text style={[styles.itemQty, { fontWeight: 'bold' }]}>Cant</Text>
          <Text style={[styles.itemPrice, { fontWeight: 'bold' }]}>Precio</Text>
          <Text style={[styles.itemPrice, { fontWeight: 'bold' }]}>Total</Text>
        </View>

        <View style={styles.divider} />

        {/* Items */}
        {data.items.map((item, index) => (
          <View key={index} style={styles.itemRow}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemQty}>{item.qty}</Text>
            <Text style={styles.itemPrice}>€{item.price.toFixed(2)}</Text>
            <Text style={styles.itemPrice}>€{item.total.toFixed(2)}</Text>
          </View>
        ))}

        <View style={styles.divider} />

        {/* Totals */}
        <View style={styles.row}>
          <Text>Subtotal</Text>
          <Text>€{data.subtotal.toFixed(2)}</Text>
        </View>
        <View style={styles.row}>
          <Text>IVA (10%)</Text>
          <Text>€{data.tax.toFixed(2)}</Text>
        </View>
        {data.tip > 0 && (
          <View style={styles.row}>
            <Text>Propina</Text>
            <Text>€{data.tip.toFixed(2)}</Text>
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TOTAL</Text>
          <Text style={styles.totalValue}>€{data.total.toFixed(2)}</Text>
        </View>

        {/* Payment Info */}
        <View style={styles.paymentInfo}>
          <View style={styles.row}>
            <Text>Método de pago:</Text>
            <Text>{data.paymentMethod}</Text>
          </View>
          {data.cashReceived && (
            <>
              <View style={styles.row}>
                <Text>Recibido:</Text>
                <Text>€{data.cashReceived.toFixed(2)}</Text>
              </View>
              <View style={styles.row}>
                <Text>Cambio:</Text>
                <Text>€{(data.change || 0).toFixed(2)}</Text>
              </View>
            </>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>¡Gracias por su visita!</Text>
          <Text>Vuelva pronto</Text>
          <Text style={{ marginTop: 5 }}>
            IVA incluido - Conserve su ticket
          </Text>
        </View>
      </Page>
    </Document>
  );
}

// Helper function to generate and download PDF
export async function generateReceiptPDF(data: ReceiptData): Promise<Blob> {
  const doc = <POSReceiptDocument data={data} />;
  const blob = await pdf(doc).toBlob();
  return blob;
}

// Helper to download PDF
export function downloadReceiptPDF(data: ReceiptData, filename?: string) {
  generateReceiptPDF(data).then(blob => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `ticket-${data.ticketNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });
}

// Helper to print PDF (opens in new window)
export function printReceiptPDF(data: ReceiptData) {
  generateReceiptPDF(data).then(blob => {
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  });
}
