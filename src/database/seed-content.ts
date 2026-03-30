import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import { AppContent, ContentType } from './entities/app-content.entity';
import { Faq } from './entities/faq.entity';

/**
 * Seed script to create initial app content (terms, privacy, FAQ, etc.)
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/database/seed-content.ts
 */

async function seed() {
    const databaseUrl = process.env.DATABASE_URL || '';

    const connectionOptions: any = databaseUrl
        ? { url: databaseUrl }
        : {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432', 10),
            username: process.env.DB_USERNAME || 'postgres',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'postgres',
        };

    const dataSource = new DataSource({
        type: 'postgres',
        ...connectionOptions,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        entities: [AppContent, Faq],
        synchronize: false,
    });

    try {
        await dataSource.initialize();
        console.log('Connected to database.');

        const contentRepo = dataSource.getRepository(AppContent);
        const faqRepo = dataSource.getRepository(Faq);

        // ─── SEED APP CONTENT ───────────────────────────────────

        const contentItems = [
            {
                type: ContentType.TERMS,
                title: 'Terms of Service',
                locale: 'en',
                content: `# Terms of Service

## 1. Acceptance of Terms
By accessing or using Methna, you agree to be bound by these Terms of Service.

## 2. Eligibility
You must be at least 18 years old to use this service. By using Methna, you represent and warrant that you are at least 18 years of age.

## 3. User Conduct
You agree to use Methna only for lawful purposes and in accordance with these Terms. You agree not to:
- Use the service for any unlawful purpose
- Harass, abuse, or harm another person
- Provide false or misleading information
- Attempt to circumvent any security features

## 4. Privacy
Your privacy is important to us. Please review our Privacy Policy to understand how we collect and use your information.

## 5. Account Security
You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.

## 6. Termination
We reserve the right to terminate or suspend your account at any time for violations of these Terms.

## 7. Contact
For questions about these Terms, please contact us at support@methna.app`,
            },
            {
                type: ContentType.TERMS,
                title: 'شروط الخدمة',
                locale: 'ar',
                content: `# شروط الخدمة

## 1. قبول الشروط
باستخدامك لتطبيق مثنى، فإنك توافق على الالتزام بشروط الخدمة هذه.

## 2. الأهلية
يجب أن يكون عمرك 18 عامًا على الأقل لاستخدام هذه الخدمة.

## 3. سلوك المستخدم
توافق على استخدام مثنى للأغراض المشروعة فقط.

## 4. الخصوصية
خصوصيتك مهمة بالنسبة لنا. يرجى مراجعة سياسة الخصوصية الخاصة بنا.

## 5. أمان الحساب
أنت مسؤول عن الحفاظ على سرية بيانات حسابك.

## 6. الإنهاء
نحتفظ بالحق في إنهاء أو تعليق حسابك في أي وقت.

## 7. الاتصال
للاستفسارات، يرجى التواصل معنا على support@methna.app`,
            },
            {
                type: ContentType.PRIVACY,
                title: 'Privacy Policy',
                locale: 'en',
                content: `# Privacy Policy

## Information We Collect
We collect information you provide directly, such as:
- Profile information (name, photos, bio)
- Contact information (email, phone)
- Location data (with your permission)
- Usage data and preferences

## How We Use Your Information
We use your information to:
- Provide and improve our services
- Match you with compatible users
- Send notifications and updates
- Ensure safety and security

## Data Security
We implement appropriate security measures to protect your personal information.

## Your Rights
You have the right to:
- Access your data
- Correct inaccurate data
- Delete your account
- Export your data

## Contact Us
For privacy-related questions: privacy@methna.app`,
            },
            {
                type: ContentType.PRIVACY,
                title: 'سياسة الخصوصية',
                locale: 'ar',
                content: `# سياسة الخصوصية

## المعلومات التي نجمعها
نجمع المعلومات التي تقدمها مباشرة، مثل:
- معلومات الملف الشخصي
- معلومات الاتصال
- بيانات الموقع
- بيانات الاستخدام

## كيف نستخدم معلوماتك
نستخدم معلوماتك لتقديم وتحسين خدماتنا.

## أمان البيانات
نطبق تدابير أمنية مناسبة لحماية معلوماتك.

## حقوقك
لديك الحق في الوصول إلى بياناتك وتصحيحها وحذفها.

## اتصل بنا
للاستفسارات المتعلقة بالخصوصية: privacy@methna.app`,
            },
            {
                type: ContentType.ACCESSIBILITY,
                title: 'Accessibility Statement',
                locale: 'en',
                content: `# Accessibility Statement

## Our Commitment
Methna is committed to ensuring digital accessibility for people with disabilities.

## Accessibility Features
- Screen reader compatibility
- Keyboard navigation support
- High contrast mode support
- Adjustable text sizes
- Clear and simple navigation

## Feedback
We welcome your feedback on the accessibility of Methna. Please contact us at accessibility@methna.app`,
            },
            {
                type: ContentType.ACCESSIBILITY,
                title: 'بيان إمكانية الوصول',
                locale: 'ar',
                content: `# بيان إمكانية الوصول

## التزامنا
تلتزم مثنى بضمان إمكانية الوصول الرقمي للأشخاص ذوي الإعاقة.

## ميزات إمكانية الوصول
- توافق قارئ الشاشة
- دعم التنقل بلوحة المفاتيح
- دعم وضع التباين العالي

## التعليقات
نرحب بملاحظاتك على accessibility@methna.app`,
            },
            {
                type: ContentType.ABOUT,
                title: 'About Methna',
                locale: 'en',
                content: `# About Methna

Methna is a halal matrimony app designed to help Muslims find their life partners in a respectful and Islamic manner.

## Our Mission
To facilitate meaningful connections that lead to successful marriages within the Muslim community.

## Our Values
- **Respect**: We prioritize respectful interactions
- **Privacy**: Your data and conversations are protected
- **Authenticity**: Verified profiles ensure genuine connections
- **Faith**: Our platform aligns with Islamic values

## Contact
support@methna.app`,
            },
            {
                type: ContentType.ABOUT,
                title: 'عن مثنى',
                locale: 'ar',
                content: `# عن مثنى

مثنى هو تطبيق زواج حلال مصمم لمساعدة المسلمين في العثور على شركاء حياتهم بطريقة محترمة وإسلامية.

## مهمتنا
تسهيل الروابط الهادفة التي تؤدي إلى زيجات ناجحة.

## قيمنا
- الاحترام
- الخصوصية
- المصداقية
- الإيمان

## اتصل بنا
support@methna.app`,
            },
            {
                type: ContentType.COMMUNITY_GUIDELINES,
                title: 'Community Guidelines',
                locale: 'en',
                content: `# Community Guidelines

## Be Respectful
Treat others the way you want to be treated. Harassment, hate speech, and discrimination are not tolerated.

## Be Honest
Use recent photos and accurate information. Misrepresentation violates our terms.

## Keep It Appropriate
This is a family-friendly platform. Keep conversations respectful and appropriate.

## Report Concerns
If you encounter inappropriate behavior, please report it immediately.

## Safety First
Never share personal financial information. Meet in public places for first meetings.`,
            },
            {
                type: ContentType.SAFETY_TIPS,
                title: 'Safety Tips',
                locale: 'en',
                content: `# Safety Tips

## Online Safety
- Never share financial information
- Don't share personal details too quickly
- Trust your instincts

## Meeting in Person
- Meet in public places
- Tell a friend or family member your plans
- Arrange your own transportation
- Keep your phone charged

## Reporting
Report any suspicious behavior to our support team immediately.`,
            },
            {
                type: ContentType.CONTACT_US,
                title: 'Contact Us',
                locale: 'en',
                content: `# Contact Us

## General Support
Email: support@methna.app

## Privacy Concerns
Email: privacy@methna.app

## Report Abuse
Email: safety@methna.app

## Business Inquiries
Email: business@methna.app

We aim to respond within 24-48 hours.`,
            },
        ];

        for (const item of contentItems) {
            const existing = await contentRepo.findOne({
                where: { type: item.type, locale: item.locale },
            });
            if (!existing) {
                await contentRepo.save(contentRepo.create({
                    ...item,
                    isPublished: true,
                }));
                console.log(`Created: ${item.type} (${item.locale})`);
            } else {
                console.log(`Exists: ${item.type} (${item.locale})`);
            }
        }

        // ─── SEED FAQs ───────────────────────────────────────────

        const faqs = [
            { question: 'How do I create an account?', answer: 'Download the app, tap "Sign Up", and follow the registration process. You will need to verify your email address.', category: 'account', locale: 'en', order: 1 },
            { question: 'How do I verify my profile?', answer: 'Go to Settings > Profile Verification and follow the selfie verification process. This helps build trust with other users.', category: 'account', locale: 'en', order: 2 },
            { question: 'How does matching work?', answer: 'When two users like each other, it creates a match. You can then start messaging each other.', category: 'matching', locale: 'en', order: 1 },
            { question: 'Can I undo a swipe?', answer: 'Premium users can undo their last swipe. Free users do not have this feature.', category: 'matching', locale: 'en', order: 2 },
            { question: 'What are the subscription plans?', answer: 'We offer Free, Premium, and Gold plans. Premium includes unlimited swipes and see who liked you. Gold adds profile boost.', category: 'subscription', locale: 'en', order: 1 },
            { question: 'How do I cancel my subscription?', answer: 'Go to Settings > Subscription and tap "Cancel Subscription". Your benefits will continue until the end of your billing period.', category: 'subscription', locale: 'en', order: 2 },
            { question: 'How do I report a user?', answer: 'Open the user\'s profile, tap the three dots menu, and select "Report". Choose the reason and provide details.', category: 'safety', locale: 'en', order: 1 },
            { question: 'How do I block someone?', answer: 'Open the user\'s profile or conversation, tap the three dots menu, and select "Block". They will no longer be able to contact you.', category: 'safety', locale: 'en', order: 2 },
            { question: 'How do I delete my account?', answer: 'Go to Settings > Account > Delete Account. This action is permanent and cannot be undone.', category: 'privacy', locale: 'en', order: 1 },
            { question: 'Who can see my profile?', answer: 'Only registered users can see your profile. You can adjust visibility settings in Privacy settings.', category: 'privacy', locale: 'en', order: 2 },
            // Arabic FAQs
            { question: 'كيف أنشئ حسابًا؟', answer: 'قم بتحميل التطبيق واضغط على "تسجيل" واتبع خطوات التسجيل.', category: 'account', locale: 'ar', order: 1 },
            { question: 'كيف يعمل المطابقة؟', answer: 'عندما يعجب مستخدمان ببعضهما البعض، يتم إنشاء تطابق ويمكنهما بدء المحادثة.', category: 'matching', locale: 'ar', order: 1 },
        ];

        for (const faq of faqs) {
            const existing = await faqRepo.findOne({
                where: { question: faq.question, locale: faq.locale },
            });
            if (!existing) {
                await faqRepo.save(faqRepo.create({
                    ...faq,
                    isPublished: true,
                }));
                console.log(`Created FAQ: ${faq.question.substring(0, 30)}...`);
            }
        }

        console.log('');
        console.log('=== Content Seed Complete ===');
        console.log('');

        await dataSource.destroy();
    } catch (error) {
        console.error('Seed failed:', error);
        process.exit(1);
    }
}

seed();
