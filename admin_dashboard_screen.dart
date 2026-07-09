import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({Key? key}) : super(key: key);

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  final MobileScannerController _scannerController = MobileScannerController();
  final String _apiUrl = 'http://10.0.2.2:3000/api'; // Change to localhost or server IP if needed
  final String _authToken = 'dev-mock-token';

  bool _isProcessing = false;
  bool _isLoading = false;
  Map<String, dynamic>? _subscriberData;
  String? _errorMessage;

  @override
  void dispose() {
    _scannerController.dispose();
    super.dispose();
  }

  Future<void> _handleBarcode(BarcodeCapture capture) async {
    if (_isProcessing) return;

    final List<Barcode> barcodes = capture.barcodes;
    if (barcodes.isNotEmpty) {
      final String? rawValue = barcodes.first.rawValue;
      if (rawValue != null) {
        setState(() {
          _isProcessing = true;
          _isLoading = true;
          _errorMessage = null;
          _subscriberData = null;
        });
        
        // إيقاف الكاميرا مؤقتاً لمنع التكرار
        _scannerController.stop();

        try {
          // Fetch subscriber via Node.js API
          final response = await http.get(
            Uri.parse('$_apiUrl/subscribers/$rawValue'),
            headers: {'Authorization': 'Bearer $_authToken'},
          );

          if (response.statusCode == 200) {
            final data = json.decode(response.body);
            setState(() {
              _subscriberData = data;
              _isLoading = false;
            });
          } else if (response.statusCode == 404) {
            setState(() {
              _errorMessage = 'لم يتم العثور على المشترك. تأكد من صحة الكود.';
              _isLoading = false;
            });
          } else {
            setState(() {
              _errorMessage = 'حدث خطأ في الخادم (الكود: ${response.statusCode})';
              _isLoading = false;
            });
          }
        } catch (e) {
          setState(() {
            _errorMessage = 'حدث خطأ أثناء الاتصال بالخادم: $e';
            _isLoading = false;
          });
        }
      }
    }
  }

  Future<void> _verifySubscription() async {
    if (_subscriberData == null) return;

    setState(() {
      _isLoading = true;
    });

    try {
      // Update subscription status via Node.js API
      final response = await http.put(
        Uri.parse('$_apiUrl/subscribers/${_subscriberData!['id']}/verify'),
        headers: {'Authorization': 'Bearer $_authToken'},
      );

      if (response.statusCode != 200) {
        throw Exception('Server error: ${response.statusCode}');
      }

      setState(() {
        _subscriberData!['isVerified'] = true;
        _isLoading = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('تم تأكيد الدفع وتفعيل الاشتراك بنجاح'),
            backgroundColor: Colors.green,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('فشل في تحديث حالة الاشتراك: $e'),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  void _resumeScanning() {
    setState(() {
      _isProcessing = false;
      _subscriberData = null;
      _errorMessage = null;
    });
    // إعادة تشغيل الكاميرا
    _scannerController.start();
  }

  @override
  Widget build(BuildContext context) {
    // استخدمنا LayoutBuilder لتوفير استجابة (Responsive Design)
    return Scaffold(
      appBar: AppBar(
        title: const Text('لوحة تحكم Flykidz Gym'),
        backgroundColor: const Color(0xFF131313),
        foregroundColor: const Color(0xFFE9C400),
      ),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final isDesktop = constraints.maxWidth > 800;

          if (isDesktop) {
            // شاشات الكمبيوتر: مقسمة طولياً (Row)
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 1,
                  child: _buildScannerSection(),
                ),
                const VerticalDivider(width: 1, color: Colors.grey),
                Expanded(
                  flex: 2,
                  child: _buildDetailsSection(),
                ),
              ],
            );
          } else {
            // شاشات الهواتف: مقسمة عمودياً (Column)
            return SingleChildScrollView(
              child: Column(
                children: [
                  SizedBox(
                    height: 350,
                    width: double.infinity,
                    child: _buildScannerSection(),
                  ),
                  const Divider(height: 1, color: Colors.grey),
                  _buildDetailsSection(),
                ],
              ),
            );
          }
        },
      ),
    );
  }

  Widget _buildScannerSection() {
    return Container(
      color: Colors.black,
      child: Stack(
        alignment: Alignment.center,
        children: [
          MobileScanner(
            controller: _scannerController,
            onDetect: _handleBarcode,
          ),
          if (!_isProcessing)
            Positioned(
              bottom: 24,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.7),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFE9C400), width: 1),
                ),
                child: const Text(
                  'وجه الكاميرا نحو كود QR',
                  style: TextStyle(
                    color: Colors.white, 
                    fontSize: 16, 
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.2,
                  ),
                ),
              ),
            ),
          if (_isProcessing && !_isLoading && _subscriberData == null && _errorMessage == null)
            const Center(
              child: CircularProgressIndicator(color: Color(0xFFE9C400)),
            ),
        ],
      ),
    );
  }

  Widget _buildDetailsSection() {
    if (_isLoading) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(color: Color(0xFFE9C400)),
              SizedBox(height: 16),
              Text(
                'جاري جلب البيانات...',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              )
            ],
          ),
        ),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, color: Colors.red, size: 80),
              const SizedBox(height: 24),
              Text(
                _errorMessage!,
                style: const TextStyle(fontSize: 20, color: Colors.red, fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              ElevatedButton.icon(
                onPressed: _resumeScanning,
                icon: const Icon(Icons.qr_code_scanner),
                label: const Text('إعادة مسح الكود'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF131313),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (_subscriberData != null) {
      final isVerified = _subscriberData!['isVerified'] == true;
      
      return SingleChildScrollView(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'بيانات المشترك',
                  style: TextStyle(
                    fontSize: 28, 
                    fontWeight: FontWeight.w900,
                    fontStyle: FontStyle.italic,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: isVerified ? Colors.green.withOpacity(0.1) : const Color(0xFFE9C400).withOpacity(0.1),
                    border: Border.all(
                      color: isVerified ? Colors.green : const Color(0xFFE9C400),
                      width: 2,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        isVerified ? Icons.check_circle : Icons.pending_actions,
                        color: isVerified ? Colors.green : const Color(0xFFE9C400),
                        size: 24,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        isVerified ? 'مؤكد' : 'قيد المراجعة',
                        style: TextStyle(
                          color: isVerified ? Colors.green : const Color(0xFFE9C400),
                          fontWeight: FontWeight.w900,
                          fontSize: 16,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 32),
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFF1C1B1B),
                border: Border.all(color: const Color(0xFF4D4732)),
              ),
              padding: const EdgeInsets.all(24.0),
              child: Column(
                children: [
                  _buildInfoRow('الاسم:', _subscriberData!['fullName'] ?? 'غير متوفر'),
                  const Divider(color: Color(0xFF4D4732), height: 32),
                  _buildInfoRow('العمر:', '${_subscriberData!['age'] ?? '-'} سنة'),
                  const Divider(color: Color(0xFF4D4732), height: 32),
                  _buildInfoRow('رقم الواتساب:', _subscriberData!['whatsappNumber'] ?? 'غير متوفر'),
                  const Divider(color: Color(0xFF4D4732), height: 32),
                  _buildInfoRow('نوع الحصة:', _subscriberData!['classType'] ?? 'غير متوفر'),
                  const Divider(color: Color(0xFF4D4732), height: 32),
                  _buildInfoRow('نوع الباقة:', _subscriberData!['packageType'] ?? 'غير متوفر'),
                ],
              ),
            ),
            const SizedBox(height: 32),
            const Text(
              'إيصال الدفع',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, fontStyle: FontStyle.italic),
            ),
            const SizedBox(height: 16),
            Container(
              width: double.infinity,
              height: 350,
              decoration: BoxDecoration(
                color: const Color(0xFF0F0F0F),
                border: Border.all(color: const Color(0xFF4D4732), width: 2),
              ),
              child: _subscriberData!['receiptImageBase64'] != null
                  ? Image.memory(
                      base64Decode(_subscriberData!['receiptImageBase64'].split(',').last),
                      fit: BoxFit.contain,
                      errorBuilder: (context, error, stackTrace) =>
                          const Center(
                            child: Text('تعذر تحميل الصورة', style: TextStyle(color: Colors.grey)),
                          ),
                    )
                  : const Center(
                      child: Text('لا يوجد إيصال مرفق', style: TextStyle(color: Colors.grey, fontSize: 18)),
                    ),
            ),
            const SizedBox(height: 40),
            if (!isVerified)
              SizedBox(
                width: double.infinity,
                height: 64,
                child: ElevatedButton.icon(
                  onPressed: _verifySubscription,
                  icon: const Icon(Icons.verified),
                  label: const Text('تأكيد الدفع وتفعيل الاشتراك'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFE9C400),
                    foregroundColor: const Color(0xFF3A3000),
                    textStyle: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
                    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
                  ),
                ),
              ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              height: 64,
              child: OutlinedButton.icon(
                onPressed: _resumeScanning,
                icon: const Icon(Icons.qr_code_scanner),
                label: const Text('مسح كود متدرب آخر'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFE5E2E1),
                  side: const BorderSide(color: Color(0xFF999077), width: 2),
                  shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
                  textStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ],
        ),
      );
    }

    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.qr_code_scanner, size: 100, color: Colors.grey),
          SizedBox(height: 24),
          Text(
            'في انتظار مسح الكود...',
            style: TextStyle(fontSize: 20, color: Colors.grey, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 140,
          child: Text(
            label,
            style: const TextStyle(
              fontWeight: FontWeight.bold,
              color: Color(0xFF999077),
              fontSize: 16,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(
              fontWeight: FontWeight.w900,
              fontSize: 18,
              color: Color(0xFFE5E2E1),
            ),
          ),
        ),
      ],
    );
  }
}
