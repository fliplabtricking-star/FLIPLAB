import React from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { downloadIdCard } from '../../utils/downloadIdCard';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

export function SuccessPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const location = useLocation();
  const subscriberData = location.state?.subscriberData;
  const { width, height } = useWindowSize();
  const [showConfetti, setShowConfetti] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="mb-12 flex flex-col items-center justify-center font-sans tracking-tighter italic" style={{ lineHeight: '0.85' }}>
        <span className="text-6xl font-black text-primary">FLIPLAB</span>
        <span className="text-6xl font-black text-primary">ACADEMY</span>
      </div>
      <div className="max-w-md w-full bg-[#0f0f0f] border-2 border-outline-variant shadow-[16px_16px_0px_0px_rgba(233,196,0,0.1)] p-10 text-center relative">
        {/* Decorative corner accents */}
        <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary m-[-2px]"></div>
        <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary m-[-2px]"></div>
        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary m-[-2px]"></div>
        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary m-[-2px]"></div>
        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary m-[-2px]"></div>

        {showConfetti && <Confetti width={width} height={height} colors={['#e9c400', '#131313', '#ffffff', '#ffd700']} recycle={false} numberOfPieces={400} gravity={0.15} style={{ zIndex: 100 }} />}

        <CheckCircle2 className="mx-auto h-20 w-20 text-primary mb-8 animate-pulse" />
        <h2 className="text-4xl sm:text-5xl font-black text-on-surface uppercase tracking-tighter mb-4 italic glitch" data-text={t('success.accessGranted')}>
          {t('success.accessGranted')}
        </h2>
        <p className="text-secondary font-mono text-xs mb-10 uppercase tracking-widest border border-outline-variant p-2 inline-block bg-surface-container-highest">{t('success.instruction')}</p>
        
        <div className="bg-[#131313] p-8 border-4 border-outline-variant flex justify-center items-center mx-auto mb-10 w-fit relative group">
          <div className="absolute inset-0 border-[4px] border-primary opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 m-[-4px]"></div>
          <div className="bg-white p-4">
            <QRCode id="qr-code-success" value={id || ''} size={220} bgColor="#ffffff" fgColor="#000000" />
          </div>
        </div>
        
        <p className="text-sm text-primary mb-10 break-all font-mono tracking-widest font-bold">ID: {id}</p>
        
        <div className="flex flex-col gap-4">
          <button 
            onClick={() => {
              if (id) {
                downloadIdCard(
                  id, 
                  subscriberData?.fullName, 
                  subscriberData?.classType, 
                  subscriberData?.packageType,
                  'qr-code-success'
                );
              }
            }}
            className="w-full flex justify-center items-center py-4 px-6 bg-primary text-on-primary text-lg font-black uppercase tracking-widest hover:bg-primary-container transition-colors focus:outline-none hover:shadow-[0_0_15px_rgba(233,196,0,0.3)] active:scale-[0.98]"
          >
            DOWNLOAD DIGITAL PASS
          </button>
          
          <Link 
            to="/" 
            className="w-full flex justify-center items-center py-4 px-6 border-2 border-primary text-lg font-black text-primary bg-transparent uppercase tracking-widest hover:bg-primary hover:text-on-primary transition-colors focus:outline-none hover:shadow-[0_0_15px_rgba(255,215,0,0.3)] active:scale-[0.98]"
          >
            {t('success.returnHome')}
          </Link>
        </div>
      </div>
    </div>
  );
}
