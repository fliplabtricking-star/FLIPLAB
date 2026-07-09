import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Subscriber } from '../../domain/entities/subscriber.ts';
import { subscriberRepository } from '../../data/repositories/subscriber_repository.ts';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useMotionTemplate } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Toast } from '../components/Toast.tsx';
import { TiltCard } from '../components/TiltCard.tsx';

export function RegistrationForm() {
  const { register, handleSubmit, watch, control, formState: { errors } } = useForm<Subscriber>();
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageBase64, setImageBase64] = useState<string>('');
  const [imageError, setImageError] = useState<string>('');
  const [classRules, setClassRules] = useState<any>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [isQRCodeExpanded, setIsQRCodeExpanded] = useState(false);

  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
  };
  
  useEffect(() => {
    fetch('/api/settings/classes')
      .then(res => res.json())
      .then(data => setClassRules(data))
      .catch(err => console.error("Failed to load class rules", err));
  }, []);
  
  const [bgIndex, setBgIndex] = useState(0);
  const bgs = ['/assets/bg1.jpg', '/assets/bg2.jpg'];

  useEffect(() => {
    const interval = setInterval(() => {
      setBgIndex(prev => (prev + 1) % bgs.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);
  
  const navigate = useNavigate();
  
  const age = watch('age');
  const classType = watch('classType');

  // Business Rules Logic
  let availableClassTypes: ('Parkour' | 'Tricking')[] = [];
  if (classRules) {
    if (age >= classRules.Parkour.minAge && age <= classRules.Parkour.maxAge) {
      availableClassTypes.push('Parkour');
    }
    if (age >= classRules.Tricking.minAge && age <= classRules.Tricking.maxAge) {
      availableClassTypes.push('Tricking');
    }
  }

  // Pre-select or clear classType when age changes
  useEffect(() => {
    if (availableClassTypes.length === 1) {
      if (classType !== availableClassTypes[0]) {
        // Just visually, we don't strictly need to setValue if we rely on onSubmit
      }
    }
  }, [age]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setImageError("File size exceeds 5MB limit.");
        return;
      }
      setImageError('');
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: Subscriber) => {
    if (!imageBase64) {
      setImageError('Payment receipt is required');
      return;
    }
    
    if (availableClassTypes.length === 0) {
      showToast("Invalid age for any class.", 'error');
      return;
    }

    const finalClassType = availableClassTypes.length === 1 ? availableClassTypes[0] : data.classType;
    if (!finalClassType || !availableClassTypes.includes(finalClassType)) {
      showToast("Please select a valid class type.", 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const subscriberData: Subscriber = {
        ...data,
        classType: finalClassType,
        receiptImageBase64: imageBase64,
      };

      const id = await subscriberRepository.register(subscriberData);
      showToast("Registration successful!", 'success');
      setTimeout(() => navigate(`/success/${id}`, { state: { subscriberData } }), 1000);
    } catch (error) {
      console.error(error);
      showToast('Failed to register. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onError = (errors: any) => {
    console.error("Validation errors:", errors);
    showToast('Please fill in all required fields.', 'error');
    if (!imageBase64) {
      setImageError('Payment receipt is required');
    }
  };

  return (
    <div className="min-h-screen text-on-background py-12 px-4 sm:px-6 lg:px-8 font-sans flex items-center justify-center relative overflow-hidden">
      <AnimatePresence>
        {showSplash && (
          <motion.div 
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="fixed inset-0 z-50 bg-[#0f0f0f] flex flex-col items-center justify-center font-sans tracking-tighter italic"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="flex flex-col items-center"
              style={{ lineHeight: '0.85' }}
            >
              <span className="text-7xl sm:text-8xl md:text-9xl font-black text-[#e9c400] drop-shadow-[0_0_20px_rgba(233,196,0,0.5)]">FLIPLAB</span>
              <span className="text-7xl sm:text-8xl md:text-9xl font-black text-white">ACADEMY</span>
            </motion.div>
            
            <motion.div 
              className="mt-16 h-[2px] bg-[#222] w-64 overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <motion.div 
                className="h-full bg-[#e9c400] shadow-[0_0_10px_#e9c400]"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.2, ease: "easeInOut", delay: 0.4 }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isQRCodeExpanded && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setIsQRCodeExpanded(false)}
          >
            <motion.img 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              src="/assets/payment-qr.jpg" 
              alt="Payment QR Code Enlarged" 
              className="w-full max-w-lg h-auto object-contain bg-white p-8 rounded-3xl border-4 border-primary shadow-[0_0_50px_rgba(233,196,0,0.3)]"
            />
            <button 
              className="absolute top-8 right-8 text-white hover:text-primary transition-colors"
              onClick={(e) => { e.stopPropagation(); setIsQRCodeExpanded(false); }}
            >
              <span className="material-symbols-outlined text-5xl drop-shadow-md">close</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {toastMessage && <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage('')} />}
      
      {/* Dynamic Background Slideshow */}
      <div className="fixed inset-0 z-0 bg-background">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={bgIndex}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 0.6, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, ease: "easeInOut" }}
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${bgs[bgIndex]})` }}
          />
        </AnimatePresence>
        {/* Overlays for contrast and professional look */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#131313]/80 via-[#131313]/90 to-[#131313]"></div>
        <motion.div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: useMotionTemplate`radial-gradient(circle 800px at ${mouseX}px ${mouseY}px, rgba(233,196,0,0.06), transparent 80%)`
          }}
        />
      </div>

      {!classRules ? (
        <div className="relative z-20 flex flex-col items-center justify-center h-96">
           <Loader2 className="w-16 h-16 animate-spin text-primary drop-shadow-[0_0_15px_rgba(233,196,0,0.5)]" />
           <p className="text-primary mt-6 font-mono text-sm uppercase tracking-widest animate-pulse font-bold">Establishing Connection...</p>
        </div>
      ) : (
      <div className="max-w-2xl w-full glass-card rounded-xl relative z-20 overflow-hidden mt-8 mb-8">
        <div className="absolute top-0 left-0 w-16 h-16 bg-primary/20 flex items-center justify-center border-b-2 border-r-2 border-primary z-30 clip-chamfer-br">
          <span className="material-symbols-outlined text-primary text-3xl">bolt</span>
        </div>
        
        <div className="p-8 text-center bg-[#0f0f0f] border-b-2 border-outline-variant relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-bl-full pointer-events-none"></div>
          <div className="absolute top-4 right-4 flex gap-1 pointer-events-none">
            <div className="w-2 h-2 bg-primary/40 rounded-full"></div>
            <div className="w-2 h-2 bg-primary/20 rounded-full"></div>
            <div className="w-2 h-2 bg-primary/10 rounded-full"></div>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black uppercase tracking-tighter text-on-surface mb-2 italic" style={{ lineHeight: '0.85' }}>
            <span className="text-[#e9c400] drop-shadow-[0_0_10px_rgba(233,196,0,0.3)]">FLIPLAB</span><br/>ACADEMY
          </h2>
          <div className="flex items-center justify-center gap-2 mt-4 text-xs font-mono text-primary uppercase tracking-[0.3em] font-bold">
            <span>OFFICIAL REGISTRATION</span>
          </div>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit, onError)} className="px-8 py-10 space-y-8 bg-transparent relative">
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary m-4 opacity-70"></div>
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary m-4 opacity-70"></div>
          
          <div className="space-y-8 relative z-10">
            <div>
              <label className="block text-xs font-mono font-bold text-secondary uppercase tracking-widest mb-2">{t('registration.fullName')}</label>
              <input 
                type="text" 
                {...register("fullName", { required: true })}
                className={`block w-full bg-surface-container-highest border-b-2 border-transparent ${errors.fullName ? 'border-b-error' : 'border-b-outline-variant'} text-on-surface focus:border-b-primary focus:ring-0 focus:outline-none p-4 transition-colors font-bold uppercase`}
                placeholder={t('registration.fullNamePlaceholder')}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-8">
              <div>
                <label className="block text-xs font-mono font-bold text-secondary uppercase tracking-widest mb-2">{t('registration.age')}</label>
                <input 
                  type="number" 
                  {...register("age", { required: true, min: 3 })}
                  className={`block w-full bg-surface-container-highest border-b-2 border-transparent ${errors.age ? 'border-b-error' : 'border-b-outline-variant'} text-on-surface focus:border-b-primary focus:ring-0 focus:outline-none p-4 transition-colors font-bold uppercase`}
                  placeholder="0"
                />
              </div>
              
              <div>
                <label className="block text-xs font-mono font-bold text-secondary uppercase tracking-widest mb-2">{t('registration.gender')}</label>
                <select 
                  {...register("gender", { required: true })}
                  className={`block w-full bg-surface-container-highest border-b-2 border-transparent ${errors.gender ? 'border-b-error' : 'border-b-outline-variant'} text-on-surface focus:border-b-primary focus:ring-0 focus:outline-none p-4 transition-colors appearance-none font-bold uppercase`}
                >
                  <option value="" className="bg-surface-container text-secondary">SELECT...</option>
                  <option value="Male" className="bg-surface-container text-on-surface">{t('registration.male')}</option>
                  <option value="Female" className="bg-surface-container text-on-surface">{t('registration.female')}</option>
                </select>
              </div>
            </div>

            <AnimatePresence>
              {(age < 18 && age > 0) && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <label className="block text-xs font-mono font-bold text-secondary uppercase tracking-widest mb-2 mt-8">{t('registration.guardian')}</label>
                  <input 
                    type="text" 
                    {...register("guardianName", { required: age < 18 })}
                    className={`block w-full bg-surface-container-highest border-b-2 border-transparent ${errors.guardianName ? 'border-b-error' : 'border-b-outline-variant'} text-on-surface focus:border-b-primary focus:ring-0 focus:outline-none p-4 transition-colors font-bold uppercase`}
                    placeholder={t('registration.guardianPlaceholder')}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-xs font-mono font-bold text-secondary uppercase tracking-widest mb-2">{t('registration.whatsapp')}</label>
              <input 
                type="tel" 
                {...register("whatsappNumber", { required: true })}
                className={`block w-full bg-surface-container-highest border-b-2 border-transparent ${errors.whatsappNumber ? 'border-b-error' : 'border-b-outline-variant'} text-on-surface focus:border-b-primary focus:ring-0 focus:outline-none p-4 transition-colors font-bold uppercase`}
                placeholder={t('registration.whatsappPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-secondary uppercase tracking-widest mb-2">{t('registration.experience')}</label>
              <textarea 
                {...register("previousExperience")}
                className="block w-full bg-surface-container-highest border-b-2 border-transparent border-b-outline-variant text-on-surface focus:border-b-primary focus:ring-0 focus:outline-none p-4 transition-colors resize-none font-bold uppercase"
                rows={3}
                placeholder={t('registration.experiencePlaceholder')}
              />
            </div>

            <div className="glass p-8 border-l-4 border-primary rounded-r-lg shadow-lg">
              <h3 className="text-sm font-mono font-bold text-primary mb-6 uppercase tracking-widest">{t('registration.classSelection')}</h3>
              {age ? (
                availableClassTypes.length > 0 ? (
                  <div>
                    {availableClassTypes.length > 1 ? (
                      <div className="mb-8">
                        <label className="block text-xs font-mono font-bold text-secondary uppercase tracking-widest mb-4">Select Class</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {availableClassTypes.map(c => (
                            <label key={c} className="relative cursor-pointer">
                              <input type="radio" value={c} {...register("classType", { required: true })} className="peer sr-only" />
                              <TiltCard 
                                className="p-6 border border-outline-variant bg-surface-container-lowest/50 backdrop-blur-md rounded-xl transition-all duration-300 peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:shadow-[0_0_15px_rgba(233,196,0,0.3)] h-full flex flex-col justify-center items-center text-center">
                                <span className="material-symbols-outlined text-4xl mb-3 text-secondary peer-checked:text-primary transition-colors">
                                  {c === 'Parkour' ? 'directions_run' : 'air'}
                                </span>
                                <p className="font-black text-on-surface uppercase text-2xl italic transition-colors peer-checked:text-primary">{c}</p>
                                <p className="text-xs text-secondary mt-2 font-mono peer-checked:text-on-surface transition-colors">{classRules[c].schedule}</p>
                              </TiltCard>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mb-8 border-l-4 border-outline-variant pl-4">
                        <p className="text-2xl font-black text-on-surface uppercase italic">{availableClassTypes[0]} Class</p>
                        <p className="text-xs text-primary mt-1 font-mono tracking-widest">{classRules[availableClassTypes[0]].schedule}</p>
                      </div>
                    )}
                    
                    {(() => {
                      const selectedClass = availableClassTypes.length === 1 ? availableClassTypes[0] : classType;
                      if (!selectedClass || !availableClassTypes.includes(selectedClass as any)) return null;
                      return (
                        <div className="mt-8 border-t-2 border-outline-variant pt-8">
                          <label className="block text-xs font-mono font-bold text-secondary uppercase tracking-widest mb-4">Package Type</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label className="relative cursor-pointer">
                              <input type="radio" value="Monthly" {...register("packageType", { required: true })} className="peer sr-only" />
                              <TiltCard 
                                className="p-6 border border-outline-variant bg-surface-container-lowest/50 backdrop-blur-md rounded-xl transition-all duration-300 peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:shadow-[0_0_15px_rgba(233,196,0,0.3)] h-full flex flex-col justify-center items-center text-center">
                                <p className="font-black text-on-surface uppercase text-lg italic transition-colors peer-checked:text-primary mb-2">Monthly</p>
                                <div className="flex items-baseline justify-center gap-1">
                                  <span className="text-2xl font-black text-primary">RM{classRules[selectedClass as 'Parkour' | 'Tricking'].packages.Monthly.price}</span>
                                  <span className="text-xs text-secondary font-mono peer-checked:text-on-surface">/ {classRules[selectedClass as 'Parkour' | 'Tricking'].packages.Monthly.sessions} SESSIONS</span>
                                </div>
                              </TiltCard>
                            </label>
                            <label className="relative cursor-pointer">
                              <input type="radio" value="Trial" {...register("packageType", { required: true })} className="peer sr-only" />
                              <TiltCard 
                                className="p-6 border border-outline-variant bg-surface-container-lowest/50 backdrop-blur-md rounded-xl transition-all duration-300 peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:shadow-[0_0_15px_rgba(233,196,0,0.3)] h-full flex flex-col justify-center items-center text-center">
                                <p className="font-black text-on-surface uppercase text-lg italic transition-colors peer-checked:text-primary mb-2">Trial</p>
                                <div className="flex items-baseline justify-center gap-1">
                                  <span className="text-2xl font-black text-primary">RM{classRules[selectedClass as 'Parkour' | 'Tricking'].packages.Trial.price}</span>
                                  <span className="text-xs text-secondary font-mono peer-checked:text-on-surface">/ 1 SESSION</span>
                                </div>
                                {(classRules[selectedClass as 'Parkour' | 'Tricking'].packages.Trial as any).note && (
                                  <p className="text-[10px] text-primary mt-2 font-mono uppercase tracking-widest border border-primary/30 bg-primary/10 px-2 py-1 rounded-sm">
                                    {(classRules[selectedClass as 'Parkour' | 'Tricking'].packages.Trial as any).note}
                                  </p>
                                )}
                              </TiltCard>
                            </label>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="text-sm text-error font-mono font-bold border border-error p-3 inline-block">UNAVAILABLE FOR THIS AGE</p>
                )
              ) : (
                <p className="text-sm text-secondary font-mono">ENTER AGE TO VIEW AVAILABLE CLASSES</p>
              )}
            </div>

            <div className="glass p-8 border-l-4 border-primary rounded-r-lg shadow-lg">
              <h3 className="text-sm font-mono font-bold text-primary mb-6 uppercase tracking-widest text-center">Make Payment</h3>
              
              <div className="flex flex-col items-center mb-8">
                <div 
                  className="bg-white p-4 rounded-2xl shadow-2xl mb-4 cursor-zoom-in hover:scale-105 transition-transform duration-300 relative group"
                  onClick={() => setIsQRCodeExpanded(true)}
                >
                  <img src="/assets/payment-qr.jpg" alt="Payment QR Code" className="w-64 h-auto object-contain rounded-lg border-2 border-gray-200" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl flex flex-col items-center justify-center">
                    <span className="material-symbols-outlined text-white text-4xl mb-2">zoom_in</span>
                    <span className="text-white font-mono text-xs font-bold tracking-widest uppercase">Click to Enlarge</span>
                  </div>
                </div>
                <p className="text-xs text-secondary text-center font-mono uppercase tracking-widest leading-relaxed max-w-sm">
                  Scan with any of your banking apps or eWallets to transfer money or pay.
                </p>
              </div>

              <label className="block text-xs font-mono font-bold text-secondary uppercase tracking-widest mb-2 border-t border-white/10 pt-8">{t('registration.uploadReceipt')}</label>
              <div className={`border-2 border-dashed ${imageError ? 'border-error bg-error/5' : 'border-outline-variant hover:border-primary'} bg-surface-container-lowest/50 backdrop-blur-sm rounded-xl p-8 text-center hover:bg-primary/5 transition-all duration-300 cursor-pointer relative flex flex-col items-center justify-center min-h-[160px]`}>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                />
                {imageBase64 ? (
                  <motion.img 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    src={imageBase64} alt="Receipt preview" className="h-40 object-contain rounded-lg shadow-lg" />
                ) : (
                  <div className="flex flex-col items-center text-secondary group-hover:text-primary transition-colors relative z-10">
                    <span className="material-symbols-outlined text-[48px] mb-4 font-light text-primary">cloud_upload</span>
                    <p className="text-xs font-mono uppercase tracking-widest font-bold">{t('registration.uploadInstruction')}</p>
                  </div>
                )}
              </div>
              {imageError && <p className="text-xs text-error font-mono mt-2 uppercase font-bold text-center">{imageError}</p>}
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="submit"
            disabled={isSubmitting || availableClassTypes.length === 0}
            className="w-full flex justify-center items-center py-6 px-6 border-0 text-xl font-black text-on-primary bg-primary uppercase tracking-widest hover:bg-primary-container focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-[0_0_20px_rgba(233,196,0,0.4)] transition-all duration-300 mt-8"
          >
            {isSubmitting ? <Loader2 className="animate-spin h-6 w-6 text-on-primary" /> : t('registration.confirmRegistration')}
          </motion.button>
        </form>
      </div>
      )}
    </div>
  );
}
